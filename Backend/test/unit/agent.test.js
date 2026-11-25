const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ask } = require('../../assistant/agent')
const { MESSAGES } = require('../../assistant/messages')

// Gemini, retrieval, Mongo and Postgres are all faked: these tests cover the
// pipeline's decisions, not the services.

const chunk = (id, content) => ({
  id, content, title: 'Primena đubriva u višegodišnjim zasadima',
  page_start: id, page_end: id, source_key: 'Primena_djubriva_Udzbenik.pdf', source_url: null, similarity: 0.9,
})
const fiveChunks = [1, 2, 3, 4, 5].map((i) => chunk(i, `Pasus ${i}: fertigacija se primenjuje 0,5 l/ha.`))

function fakeGemini(replies) {
  const calls = []
  return {
    calls,
    generate: async (req) => {
      calls.push(JSON.parse(JSON.stringify(req)))
      const next = replies.shift()
      if (next instanceof Error) throw next
      if (!next) throw new Error('unexpected Gemini call')
      return next
    },
  }
}
const final = (args) => ({ content: { role: 'model', parts: [] }, functionCalls: [{ id: 'f', name: 'final_answer', args }] })
const toolCall = (name, args) => ({ content: { role: 'model', parts: [] }, functionCalls: [{ id: 't', name, args }] })

function deps({ chunks = fiveChunks, replies = [], access = {}, logs = [] } = {}) {
  const gemini = fakeGemini(replies)
  return {
    gemini,
    logs,
    overrides: {
      generate: gemini.generate,
      retrieve: async () => ({ sufficient: chunks.length > 0, chunks, topSimilarity: chunks.length ? 0.9 : 0.71 }),
      access,
      proposeRule: async () => ({ ok: false, error: 'not used' }),
      logQuery: async (row) => { logs.push(row) },
      now: () => Date.parse('2026-11-06T12:00:00Z'),
    },
  }
}

const settle = () => new Promise((r) => setImmediate(r))

test('out-of-corpus question returns insufficient and Gemini is never called', async () => {
  const d = deps({ chunks: [] })
  const r = await ask({ userId: 'u1', question: 'What is the capital of Australia?', lang: 'en' }, d.overrides)
  assert.equal(r.httpStatus, 200)
  assert.equal(r.body.status, 'insufficient')
  assert.equal(r.body.answer, MESSAGES.en.insufficient)
  assert.equal(d.gemini.calls.length, 0)
  await settle()
  assert.equal(d.logs[0].path, 'short_circuit')
  assert.equal(d.logs[0].topSimilarity, 0.71)
})

test('a failed retrieval is an error (503/429), never "not in my sources"', async () => {
  const d = deps()
  d.overrides.retrieve = async () => { throw new Error('embedding API down') }
  const r = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d.overrides)
  assert.equal(r.httpStatus, 503)
  assert.equal(r.body.message, MESSAGES.sr.unavailable)
  assert.equal(d.gemini.calls.length, 0)

  d.overrides.retrieve = async () => { throw Object.assign(new Error('quota'), { name: 'GeminiRateLimitError' }) }
  const limited = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d.overrides)
  assert.equal(limited.httpStatus, 429)
})

test('embedding quota exhausted: a question about their own data is still answered from tools', async () => {
  const d = deps({
    replies: [toolCall('list_parcels', {}), final({ status: 'answered', answer: 'Imate jednu parcelu: Severna livada [D1].' })],
    access: { listParcels: async () => [{ id: 'p1', name: 'Severna livada' }] },
  })
  d.overrides.retrieve = async () => { throw Object.assign(new Error('quota'), { name: 'GeminiRateLimitError' }) }
  const r = await ask({ userId: 'u1', question: 'Koje su moje parcele?' }, d.overrides)
  assert.equal(r.httpStatus, 200)
  assert.equal(r.body.status, 'answered')
  assert.match(d.gemini.calls[0].contents.at(-1).parts[0].text, /manual search is temporarily unavailable/)
})

test('[S9] with only 5 sources sent is removed and its paragraph dropped', async () => {
  const d = deps({
    replies: [final({ status: 'answered', answer: 'Fertigacija se primenjuje u voćnjacima [S1].\n\nIzmišljena tvrdnja [S9].' })],
  })
  const r = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d.overrides)
  assert.equal(r.body.status, 'partial')
  assert.equal(r.body.answer, 'Fertigacija se primenjuje u voćnjacima [S1].')
  assert.equal(r.body.flags.removedParagraphs, 1)
  assert.deepEqual(r.body.citations.map((c) => c.tag), ['S1'])
  assert.equal(r.body.citations[0].page, 1)
  assert.match(r.body.citations[0].sourceUrl, /^\/manuals\/Primena_djubriva_Udzbenik\.pdf#page=1$/)
  // the 5 chunks were actually sent, numbered in retrieval order
  const sentText = d.gemini.calls[0].contents.at(-1).parts[0].text
  assert.match(sentText, /\[S5\] \(Primena đubriva u višegodišnjim zasadima, str\. 5\)/)
})

test('a reply with no valid tags comes back as insufficient', async () => {
  const d = deps({ replies: [final({ status: 'answered', answer: 'Odgovor iz glave.\n\nI još jedan [S9].' })] })
  const r = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d.overrides)
  assert.equal(r.body.status, 'insufficient')
  assert.equal(r.body.answer, MESSAGES.sr.insufficient)
  assert.deepEqual(r.body.citations, [])
})

test('ungrounded dose is replaced; grounded dose passes', async () => {
  const d1 = deps({ replies: [final({ status: 'answered', answer: 'Primenjuje se 0,5 l/ha [S2].' })] })
  const ok = await ask({ userId: 'u1', question: 'Kako se primenjuje fertigacija?' }, d1.overrides)
  assert.equal(ok.body.answer, 'Primenjuje se 0,5 l/ha [S2].')
  assert.equal(ok.body.flags.removedDoses, 0)
  assert.equal(ok.body.status, 'answered')

  const d2 = deps({ replies: [final({ status: 'answered', answer: 'Uvod [S1].\n\nPrimenjuje se 3 l/ha [S2].' })] })
  const bad = await ask({ userId: 'u1', question: 'Kako se primenjuje fertigacija?' }, d2.overrides)
  assert.equal(bad.body.answer, `Uvod [S1].\n\n${MESSAGES.sr.doseNotShown}`)
  assert.equal(bad.body.flags.removedDoses, 1)
  assert.equal(bad.body.status, 'partial')
})

test('pesticide-flagged answers always end with the disclaimer', async () => {
  const d1 = deps({ replies: [final({ status: 'answered', answer: 'Bakar se koristi u zaštiti [S1].' })] })
  const answered = await ask({ userId: 'u1', question: 'Karenca za bakar?' }, d1.overrides)
  assert.equal(answered.body.flags.pesticideTopic, true)
  assert.ok(answered.body.answer.endsWith(MESSAGES.sr.disclaimer))

  const d2 = deps({ replies: [final({ status: 'insufficient', answer: '' })] })
  const insufficient = await ask({ userId: 'u1', question: 'How much fungicide per 10 l?', lang: 'en' }, d2.overrides)
  assert.equal(insufficient.body.status, 'insufficient')
  assert.ok(insufficient.body.answer.endsWith(MESSAGES.en.disclaimer))

  // the flag also tightens the prompt
  assert.match(d2.gemini.calls[0].systemInstruction, /Never state a product name, dose/)
})

test('malformed final answer and missing function call yield insufficient', async () => {
  const d1 = deps({ replies: [final({ status: 'maybe', answer: 42 })] })
  const r1 = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d1.overrides)
  assert.equal(r1.httpStatus, 200)
  assert.equal(r1.body.status, 'insufficient')

  const d2 = deps({ replies: [{ content: { role: 'model', parts: [{ text: '{not json' }] }, functionCalls: [] }] })
  const r2 = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d2.overrides)
  assert.equal(r2.body.status, 'insufficient')
  await settle()
  assert.match(d2.logs[0].geminiError, /malformed/)
})

test('Gemini 429 yields a clear try-again response, never a 500', async () => {
  const err = Object.assign(new Error('RESOURCE_EXHAUSTED'), { name: 'GeminiRateLimitError' })
  const d = deps({ replies: [err] })
  const r = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d.overrides)
  assert.equal(r.httpStatus, 429)
  assert.equal(r.body.message, MESSAGES.sr.rateLimited)

  const d2 = deps({ replies: [new Error('boom')] })
  const r2 = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d2.overrides)
  assert.equal(r2.httpStatus, 503)
})

test('data questions bypass the gate, call tools scoped to the JWT user and cite [D] sources', async () => {
  const seen = []
  const access = {
    findOwnedDevice: async (userId, devId) => {
      seen.push(['findOwnedDevice', userId, devId])
      return userId === 'u1' && devId === 'soil-1' ? { name: 'Soil', dev_id: 'soil-1' } : null
    },
    readings: async (devId) => {
      seen.push(['readings', devId])
      return [
        { name: 'moisture', value: 23.456, date_time: '2026-11-06T11:00:00' },
        { name: 'moisture', value: 30, date_time: '2026-11-06T10:00:00' },
      ]
    },
  }
  const d = deps({
    chunks: [],
    access,
    replies: [
      // the model even tries to smuggle another user's id in — tools ignore it
      toolCall('get_telemetry', { devId: 'soil-1', hours: 24, userId: 'u2' }),
      final({ status: 'answered', answer: 'Poslednja vlaga je 23.5 % [D1].' }),
    ],
  })
  const r = await ask({ userId: 'u1', question: 'Kolika je vlaga na mojoj parceli?' }, d.overrides)
  assert.equal(r.body.status, 'answered')
  assert.equal(r.body.answer, 'Poslednja vlaga je 23.5 % [D1].')
  assert.equal(r.body.citations[0].kind, 'data')
  assert.equal(r.body.citations[0].sourceUrl, '/uredjaji')
  assert.deepEqual(seen[0], ['findOwnedDevice', 'u1', 'soil-1'])

  const toolResponse = d.gemini.calls[1].contents.at(-1).parts[0].functionResponse.response
  assert.equal(toolResponse.tag, 'D1')
  assert.equal(toolResponse.data.variables.moisture.max, 30)
})

test('telemetry for a device the user does not own never reads data', async () => {
  let readCalled = false
  const d = deps({
    chunks: [],
    access: { findOwnedDevice: async () => null, readings: async () => { readCalled = true; return [] } },
    replies: [
      toolCall('get_telemetry', { devId: 'someone-elses' }),
      final({ status: 'insufficient', answer: '' }),
    ],
  })
  await ask({ userId: 'u1', question: 'Show readings for my device someone-elses' }, d.overrides)
  assert.equal(readCalled, false)
  const response = d.gemini.calls[1].contents.at(-1).parts[0].functionResponse.response
  assert.match(response.data.error, /not found/)
})

test('rule proposals are returned for confirmation, never created', async () => {
  const proposal = { id: '0b8f9a62-6a4c-4f3e-9d43-2f1c1c2b6e10', summary: 'Ako moisture (soil-1) < 20 → …', warnings: [], expiresAt: 'x', rule: {} }
  const d = deps({
    chunks: [],
    replies: [
      toolCall('propose_rule', { name: 'Suvo', combinator: 'AND', clauses: [], action: {} }),
      final({ status: 'answered', answer: 'Pripremio sam pravilo, potvrdite ga ispod [D1].' }),
    ],
  })
  let proposeArgs = null
  d.overrides.proposeRule = async (userId, args) => { proposeArgs = { userId, args }; return { ok: true, proposal } }
  const r = await ask({ userId: 'u1', question: 'Napravi pravilo: otvori ventil kad je vlaga ispod 20' }, d.overrides)
  assert.equal(proposeArgs.userId, 'u1')
  assert.deepEqual(r.body.proposals, [{ id: proposal.id, summary: proposal.summary, warnings: [], expiresAt: 'x' }])
  assert.equal(r.body.status, 'answered')
})

test('the last agent step may only call final_answer', async () => {
  const config = require('../../assistant/config')
  const replies = []
  for (let i = 0; i < config.MAX_AGENT_STEPS - 1; i++) replies.push(toolCall('search_manuals', { query: 'fertigacija' }))
  replies.push(final({ status: 'answered', answer: 'Fertigacija [S1].' }))
  const d = deps({ replies })
  const r = await ask({ userId: 'u1', question: 'Šta je fertigacija?' }, d.overrides)
  assert.deepEqual(d.gemini.calls.at(-1).allowedFunctionNames, ['final_answer'])
  assert.equal(r.body.status, 'answered')
})
