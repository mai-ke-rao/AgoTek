const config = require('../config')
const gemini = require('../gemini')
const { toEmbeddingText } = require('../text')

// EMBEDDING_PROVIDER=gemini (default): Gemini embeddings API. No model in the
// process, so Backend fits a 512 MB instance; the price is one small API call
// per question (~300 ms).
//
// Asymmetric task types (question vs passage) play the role of e5's
// "query:"/"passage:" prefixes. Vectors shorter than the model's native size
// are not unit length, so they are normalized here. Both sides are still
// transliterated to Latin (toEmbeddingText) so script never decides a match.

const QUERY_TIMEOUT_MS = 10000
const PASSAGE_TIMEOUT_MS = 60000
const INGEST_BACKOFF_MS = [5000, 15000, 30000, 60000, 60000, 60000]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Free tier: 30,000 tokens per minute and 1,000 texts per day. The per-minute
// limit is worth waiting out; the daily one is not.
const isDailyQuota = (err) => /per day|PerDay/i.test(String(err && err.message))

class EmbeddingDailyQuotaError extends Error {
  constructor(message) {
    super(message)
    this.name = 'EmbeddingDailyQuotaError'
  }
}

// Repeated questions (and the model re-searching the same query) cost no quota.
const QUERY_CACHE_MAX = 300
const queryCache = new Map()

function normalize(values) {
  const norm = Math.sqrt(values.reduce((s, x) => s + x * x, 0))
  return norm ? values.map((x) => x / norm) : values
}

async function request(texts, taskType, timeoutMs) {
  const ai = await gemini.getClient()
  const response = await ai.models.embedContent({
    model: config.EMBEDDING_MODEL,
    contents: texts.map(toEmbeddingText),
    config: {
      taskType,
      outputDimensionality: config.EMBEDDING_DIM,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  })
  const vectors = (response.embeddings || []).map((e) => normalize(e.values || []))
  if (vectors.length !== texts.length) {
    throw new Error(`embedding API returned ${vectors.length} vectors for ${texts.length} texts`)
  }
  for (const v of vectors) {
    if (v.length !== config.EMBEDDING_DIM) {
      throw new Error(`embedding has ${v.length} dims, expected ${config.EMBEDDING_DIM}`)
    }
  }
  return vectors
}

// A user is waiting: one quick retry on overload, then fail. A rate limit
// surfaces as GeminiRateLimitError, which the agent answers with 429.
async function embedQuery(text) {
  const key = `${config.EMBEDDING_MODEL}|${config.EMBEDDING_DIM}|${toEmbeddingText(text).toLowerCase()}`
  if (queryCache.has(key)) return queryCache.get(key)
  for (let attempt = 0; ; attempt++) {
    try {
      const [vector] = await request([text], 'RETRIEVAL_QUERY', QUERY_TIMEOUT_MS)
      if (queryCache.size >= QUERY_CACHE_MAX) queryCache.delete(queryCache.keys().next().value)
      queryCache.set(key, vector)
      return vector
    } catch (err) {
      if (gemini.isRateLimit(err)) throw new gemini.GeminiRateLimitError(err.message)
      if (attempt === 0 && gemini.isOverloaded(err)) { await sleep(500); continue }
      throw err
    }
  }
}

// Ingest (nobody waiting): ride out free-tier rate limits and overload.
async function embedPassages(texts, { backoff = INGEST_BACKOFF_MS, log = () => {} } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request(texts, 'RETRIEVAL_DOCUMENT', PASSAGE_TIMEOUT_MS)
    } catch (err) {
      if (isDailyQuota(err)) {
        throw new EmbeddingDailyQuotaError('The embedding API daily free-tier quota (1,000 texts per day) is used up. ' +
          'Run the ingest again after it resets; it continues where it stopped.')
      }
      const transient = gemini.isRateLimit(err) || gemini.isOverloaded(err) || /aborted|timed? ?out/i.test(String(err.message))
      if (!transient || attempt >= backoff.length) throw err
      log(`  embedding API busy (${String(err.message).slice(0, 80)}…), waiting ${backoff[attempt] / 1000} s`)
      await sleep(backoff[attempt])
    }
  }
}

// The chunker only needs a stable size estimate (target 350, API limit 2048
// tokens). Serbian text runs about 3 characters per subword token.
async function countTokens(text) {
  return Math.ceil(toEmbeddingText(text).length / 3)
}

module.exports = { embedQuery, embedPassages, countTokens, normalize, EmbeddingDailyQuotaError, queryCache }
