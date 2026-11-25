const { z } = require('zod')
const config = require('./config')
const { detectPesticideTopic } = require('./pesticideKeywords')
const { hasDataIntent } = require('./dataIntent')
const { SourceRegistry } = require('./sources')
const { buildSystemPrompt } = require('./prompt')
const { declarations, runTool } = require('./tools')
const { validateCitations, tagsIn, sortTags } = require('./validateCitations')
const { guardDoses } = require('./doseGuard')
const { message, normalizeLang } = require('./messages')

// One request, top to bottom:
//
//   question ─ pesticide flag (keywords, deterministic)
//            ─ embed + retrieve top-k, similarity gate
//            ─ gate failed and no sign of a data question?  → "not in my
//              sources", Gemini never called            (path short_circuit)
//            ─ agent loop: Gemini with tools; data tools return [Dn] sources,
//              search_manuals returns [Sn] chunks (gate inside the tool)
//            ─ final_answer → Zod (malformed → insufficient)
//            ─ validateCitations → guardDoses → disclaimer if flagged
//
// Only the gate, citation validation and the dose check can stop an answer.
// Every path writes one rag_query_log row.

const MAX_CALLS_PER_TURN = 6

const finalAnswerSchema = z.object({
  status: z.enum(['answered', 'partial', 'insufficient']),
  answer: z.string().max(20000),
  missing: z.array(z.string().max(500)).max(20).optional().default([]),
})

// Real implementations are required lazily so unit tests that inject fakes
// never load Mongo models, pg or the embedding model.
function resolveDeps(overrides) {
  const deps = { ...overrides }
  deps.generate ??= (...a) => require('./gemini').generate(...a)
  deps.retrieve ??= (...a) => require('./retrieval').retrieve(...a)
  deps.access ??= require('./dataAccess')
  deps.proposeRule ??= (...a) => require('./ruleProposal').proposeRule(...a)
  deps.logQuery ??= (...a) => require('./queryLog').logQuery(...a)
  deps.now ??= () => Date.now()
  return deps
}

function isRateLimitError(err) {
  return err && (err.name === 'GeminiRateLimitError' || err.status === 429)
}

// Prior turns from the client. Old [Sn] tags refer to sources from earlier
// requests, so they are stripped to avoid the model reusing them.
function historyToContents(history) {
  const out = []
  for (const h of history) {
    const role = h.role === 'assistant' ? 'model' : 'user'
    const text = role === 'model' ? h.text.replace(/\[[SD]\d+\]/g, '') : h.text
    if (text.trim()) out.push({ role, parts: [{ text }] })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

function firstUserTurn(question, preTags, registry, manualsUnavailable = false) {
  const context = manualsUnavailable
    ? 'The manual search is temporarily unavailable. Answer only the part about their own data, using the data tools; ' +
      'list anything that would need the manuals in "missing".'
    : preTags.length
    ? `Manual passages retrieved for this question (cite as [Sn]):\n\n${preTags.map((t) => registry.formatChunk(t)).join('\n\n')}`
    : 'No manual passage passed the relevance threshold for this question (search_manuals: sufficient:false). ' +
      "If it is about the user's own data, use the data tools; otherwise answer with status \"insufficient\"."
  return { role: 'user', parts: [{ text: `${question}\n\n---\n${context}` }] }
}

async function ask({ userId, question, history = [], lang }, overrides = {}) {
  const deps = resolveDeps(overrides)
  const started = deps.now()
  lang = normalizeLang(lang)

  const flag = detectPesticideTopic(question)
  const registry = new SourceRegistry(lang)
  const ctx = {
    userId: String(userId), lang, registry, deps, now: deps.now,
    proposals: [], toolsUsed: [], dataSourcesOk: 0, topSimilarity: null,
    trackSimilarity(s) {
      if (typeof s === 'number' && (this.topSimilarity === null || s > this.topSimilarity)) this.topSimilarity = s
    },
  }
  const log = {
    question, lang, path: 'error', pesticideFlag: flag.flagged,
    removedParagraphs: 0, removedDoses: 0, chunksUsed: 0, geminiError: null,
  }

  const respond = (httpStatus, body) => ({ httpStatus, body })
  const finish = (status, answer, missing, citations, removed = {}) => {
    const finalAnswer = flag.flagged ? `${answer}\n\n${message(lang, 'disclaimer')}` : answer
    return respond(200, {
      status,
      answer: finalAnswer,
      missing,
      citations,
      flags: {
        pesticideTopic: flag.flagged,
        removedParagraphs: removed.paragraphs || 0,
        removedDoses: removed.doses || 0,
      },
      proposals: ctx.proposals.map(({ id, summary, warnings, expiresAt }) => ({ id, summary, warnings, expiresAt })),
      meta: { topSimilarity: ctx.topSimilarity, chunksUsed: log.chunksUsed, tools: ctx.toolsUsed },
    })
  }

  try {
    // 1. Retrieve and gate.
    // A retrieval failure (embedding API or database down) is an error, not
    // "nothing found": it must not come back as "not in my sources".
    // Exception: when only the embedding quota is exhausted, a question about
    // the user's own data can still be answered from the data tools.
    let pre
    let manualsUnavailable = false
    try {
      pre = await deps.retrieve(ctx.userId, question)
    } catch (err) {
      if (!(isRateLimitError(err) && hasDataIntent(question))) throw err
      manualsUnavailable = true
      pre = { sufficient: false, chunks: [], topSimilarity: null }
    }
    ctx.trackSimilarity(pre.topSimilarity)
    const preTags = pre.chunks.map((c) => registry.addChunk(c))

    if (!pre.sufficient && history.length === 0 && !hasDataIntent(question)) {
      log.path = 'short_circuit'
      return finish('insufficient', message(lang, 'insufficient'), [], [])
    }

    // 2. Agent loop.
    const systemInstruction = buildSystemPrompt({
      lang, pesticideFlag: flag.flagged, today: new Date(deps.now()).toISOString().slice(0, 10),
    })
    const contents = [...historyToContents(history), firstUserTurn(question, preTags, registry, manualsUnavailable)]
    let finalArgs = null
    const session = {} // gemini.generate pins the model here (fallback stays for the whole question)

    for (let step = 0; step < config.MAX_AGENT_STEPS; step++) {
      const lastStep = step === config.MAX_AGENT_STEPS - 1
      const res = await deps.generate({
        systemInstruction,
        contents,
        functionDeclarations: declarations,
        allowedFunctionNames: lastStep ? ['final_answer'] : undefined,
        session,
      })
      contents.push(res.content)

      if (!res.functionCalls.length) break // no structured answer → insufficient below
      const final = res.functionCalls.find((c) => c.name === 'final_answer')
      if (final) {
        finalArgs = final.args
        break
      }

      const parts = []
      for (const call of res.functionCalls.slice(0, MAX_CALLS_PER_TURN)) {
        const response = await runTool(call, ctx)
        parts.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response } })
      }
      contents.push({ role: 'user', parts })
    }

    // 3. Parse, validate, guard.
    const parsed = finalAnswerSchema.safeParse(finalArgs)
    if (!parsed.success) log.geminiError = 'malformed or missing final_answer'
    const modelOut = parsed.success ? parsed.data : { status: 'insufficient', answer: '', missing: [] }

    const validated = validateCitations(modelOut, registry.tags())
    log.removedParagraphs = validated.removedParagraphs

    if (validated.status === 'insufficient') {
      log.path = 'insufficient'
      return finish('insufficient', message(lang, 'insufficient'), modelOut.missing, [], { paragraphs: validated.removedParagraphs })
    }

    const guarded = guardDoses(validated.answer, registry.texts(), lang)
    log.removedDoses = guarded.removedDoses

    let status = validated.status
    if (guarded.removedDoses > 0 && status === 'answered') status = 'partial'

    const citations = sortTags(new Set(tagsIn(guarded.answer))).map((t) => registry.citation(t)).filter(Boolean)
    log.chunksUsed = citations.filter((c) => c.kind === 'manual').length
    log.path = status

    return finish(status, guarded.answer, modelOut.missing, citations, {
      paragraphs: validated.removedParagraphs, doses: guarded.removedDoses,
    })
  } catch (err) {
    log.path = 'error'
    log.geminiError = String(err && err.message).slice(0, 500)
    if (isRateLimitError(err)) {
      return respond(429, { status: 'error', error: 'rate_limited', message: message(lang, 'rateLimited') })
    }
    console.error('assistant ask failed:', err)
    return respond(503, { status: 'error', error: 'assistant_error', message: message(lang, 'unavailable') })
  } finally {
    log.topSimilarity = ctx.topSimilarity
    log.latencyMs = deps.now() - started
    log.toolsUsed = ctx.toolsUsed
    Promise.resolve()
      .then(() => deps.logQuery(log))
      .catch((err) => console.error('rag_query_log write failed:', err.message))
  }
}

module.exports = { ask, finalAnswerSchema, historyToContents }
