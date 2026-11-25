const config = require('./config')

// Thin wrapper over @google/genai so the agent can be tested with a fake.
// Every turn uses function calling in ANY mode: the model must call a tool,
// and it ends by calling final_answer, whose parameter schema is the
// structured-output contract ({ status, answer, missing }). This replaces the
// spec's responseMimeType/responseSchema, which Gemini does not reliably
// accept in the same request as function declarations.

class GeminiRateLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GeminiRateLimitError'
  }
}

let clientPromise = null

function getClient() {
  if (!clientPromise) {
    clientPromise = import('@google/genai').then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey: config.GEMINI_API_KEY }))
    clientPromise.catch(() => { clientPromise = null })
  }
  return clientPromise
}

function isRateLimit(err) {
  const status = err && (err.status ?? err.code ?? err.response?.status)
  return status === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(String(err && err.message))
}

// "Model is experiencing high demand" (503) and transient 500s: worth one
// quick retry, then the fallback model.
function isOverloaded(err) {
  const status = err && (err.status ?? err.code ?? err.response?.status)
  return status === 503 || status === 500 || /UNAVAILABLE|high demand|overloaded|INTERNAL/i.test(String(err && err.message))
}

const isTimeout = (err) => (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) || /aborted|timed? ?out/i.test(String(err && err.message))

const RETRY_DELAY_MS = 1000
const SHORT_WAIT_MS = 20000 // longest per-minute rate limit worth waiting out while a user waits
const OVERLOAD_COOLDOWN_MS = 2 * 60 * 1000
const MAX_COOLDOWN_MS = 6 * 60 * 60 * 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// "Please retry in 6h41m36.35s" / "retryDelay":"48s" → milliseconds, or null.
function retryDelayMs(err) {
  const text = String(err && err.message)
  const long = text.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i)
  if (long) return Math.ceil(((Number(long[1]) || 0) * 3600 + (Number(long[2]) || 0) * 60 + Number(long[3])) * 1000)
  const short = text.match(/"retryDelay":\s*"([\d.]+)s"/)
  return short ? Math.ceil(Number(short[1]) * 1000) : null
}

// Models that just failed are skipped for a while (process-wide), so a model
// that is overloaded or out of its daily quota doesn't cost every question a
// failed call (or a full timeout) first.
const cooldownUntil = new Map()
const coolingDown = (model, now) => (cooldownUntil.get(model) || 0) > now

function modelOrder(session) {
  const all = [session.model, config.GEMINI_MODEL, ...config.GEMINI_FALLBACK_MODELS]
    .filter((m, i, a) => m && a.indexOf(m) === i)
  const available = all.filter((m) => !coolingDown(m, Date.now()))
  return available.length ? available : all // everything cooling down: try anyway
}

// session: one object per user question. The model that answered last is
// tried first on the next step (thought signatures in the pushed-back turns
// belong to it); the others remain fallbacks. The free tier allows only a few
// requests per minute and per day per model, and one question takes 2-4.
async function generate({ systemInstruction, contents, functionDeclarations, allowedFunctionNames, session = {} }) {
  const ai = await getClient()
  const request = (model) => ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature: 0.1,
      // Hard deadline per call: without it a stuck request holds the user's
      // HTTP request (and a Render connection) open indefinitely.
      abortSignal: AbortSignal.timeout(config.GEMINI_TIMEOUT_MS),
      tools: [{ functionDeclarations }],
      toolConfig: {
        functionCallingConfig: allowedFunctionNames
          ? { mode: 'ANY', allowedFunctionNames }
          : { mode: 'ANY' },
      },
    },
  })

  let response
  let lastErr
  let soonest = null // rate-limited model that frees up first: { model, waitMs }
  for (const model of modelOrder(session)) {
    for (let attempt = 0; attempt < 2 && !response; attempt++) {
      try {
        response = await request(model)
        session.model = model
      } catch (err) {
        lastErr = err
        // Overload gets one quick retry on the same model. Timeouts (an
        // overloaded model often hangs instead of answering 503) and rate
        // limits (quotas are per model) go straight to the next model.
        if (!(isOverloaded(err) && attempt === 0)) break
        await sleep(RETRY_DELAY_MS)
      }
    }
    if (response) break
    if (isRateLimit(lastErr)) {
      const waitMs = retryDelayMs(lastErr) ?? 60000
      cooldownUntil.set(model, Date.now() + Math.min(waitMs, MAX_COOLDOWN_MS))
      if (!soonest || waitMs < soonest.waitMs) soonest = { model, waitMs }
    } else if (isOverloaded(lastErr) || isTimeout(lastErr)) {
      cooldownUntil.set(model, Date.now() + OVERLOAD_COOLDOWN_MS)
    } else {
      break // a bad request fails the same way on every model
    }
  }
  // Every model failed, but one is only over its per-minute limit: wait it out.
  if (!response && soonest && soonest.waitMs <= SHORT_WAIT_MS) {
    await sleep(soonest.waitMs + 250)
    try {
      response = await request(soonest.model)
      session.model = soonest.model
      cooldownUntil.delete(soonest.model)
    } catch (err) {
      lastErr = err
    }
  }
  if (!response) {
    if (isRateLimit(lastErr) || soonest) throw new GeminiRateLimitError(lastErr.message)
    throw lastErr
  }

  const content = response.candidates?.[0]?.content || { role: 'model', parts: [] }
  return {
    // Pushed back verbatim so thought signatures survive between turns.
    content: { role: 'model', parts: content.parts || [] },
    functionCalls: (response.functionCalls || []).map((c) => ({ id: c.id, name: c.name, args: c.args || {} })),
  }
}

// Tests only: replace the SDK client with a fake ({ models: { generateContent } }).
function setClientForTests(fake) {
  clientPromise = Promise.resolve(fake)
  cooldownUntil.clear()
}

module.exports = { generate, getClient, GeminiRateLimitError, isRateLimit, isOverloaded, retryDelayMs, setClientForTests }
