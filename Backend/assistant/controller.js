const router = require('express').Router()
const { z } = require('zod')
const config = require('./config')
const assistant = require('./index')
const { message, normalizeLang } = require('./messages')
const { userExtractor } = require('../utils/middleware')

// /api/assistant — JWT required on every route. The user id passed to the
// agent and the proposal endpoints always comes from the verified token.

router.use(userExtractor, (request, response, next) => {
  if (!request.user) return response.status(401).json({ error: 'auth error' })
  next()
})

const askSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  lang: z.enum(['sr', 'en']).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string().max(4000),
  })).max(10).optional().default([]),
})

// Per-user sliding window to protect the Gemini free-tier quota. In-memory is
// enough for one Render instance.
const recent = new Map()
function rateLimited(userId) {
  const now = Date.now()
  const hits = (recent.get(userId) || []).filter((t) => now - t < 60_000)
  if (hits.length >= config.RATE_LIMIT_PER_MIN) {
    recent.set(userId, hits)
    return true
  }
  hits.push(now)
  recent.set(userId, hits)
  return false
}

async function requireReady(request, response, next) {
  if (await assistant.ready()) return next()
  const lang = normalizeLang(request.body && request.body.lang)
  return response.status(503).json({ error: 'assistant_unavailable', message: message(lang, 'unavailable') })
}

router.get('/status', (request, response) => {
  response.json({ status: assistant.state.status, chunks: assistant.state.chunkCount })
})

router.post('/ask', requireReady, async (request, response) => {
  const parsed = askSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'invalid request', details: parsed.error.issues })

  const userId = request.user.id.toString()
  const lang = normalizeLang(parsed.data.lang)
  if (rateLimited(userId)) {
    return response.status(429).json({ status: 'error', error: 'rate_limited', message: message(lang, 'rateLimited') })
  }

  try {
    const { ask } = require('./agent')
    const result = await ask({ userId, lang, question: parsed.data.question, history: parsed.data.history })
    return response.status(result.httpStatus).json(result.body)
  } catch (err) {
    console.error('assistant /ask failed:', err)
    return response.status(503).json({ error: 'assistant_error', message: message(lang, 'unavailable') })
  }
})

async function decide(request, response, action) {
  const { confirmProposal, rejectProposal, ProposalError } = require('./ruleProposal')
  try {
    const userId = request.user.id.toString()
    const result = action === 'confirm'
      ? await confirmProposal(userId, request.params.id, request.get('authorization'))
      : await rejectProposal(userId, request.params.id)
    return response.status(200).json(result)
  } catch (err) {
    if (err instanceof ProposalError) return response.status(err.status).json({ error: err.message })
    console.error(`assistant proposal ${action} failed:`, err)
    return response.status(503).json({ error: 'assistant_error' })
  }
}

router.post('/proposals/:id/confirm', requireReady, (req, res) => decide(req, res, 'confirm'))
router.post('/proposals/:id/reject', requireReady, (req, res) => decide(req, res, 'reject'))

module.exports = router
