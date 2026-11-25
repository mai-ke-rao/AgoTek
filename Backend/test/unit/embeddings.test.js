const { test } = require('node:test')
const assert = require('node:assert/strict')
const config = require('../../assistant/config')
const gemini = require('../../assistant/gemini')
const embedder = require('../../assistant/embedders/gemini')

config.EMBEDDING_MODEL = 'test-embedding'
config.EMBEDDING_DIM = 4

function fakeClient(behaviour) {
  const calls = []
  gemini.setClientForTests({
    models: {
      embedContent: async (req) => {
        calls.push(req)
        const r = behaviour(req, calls.length)
        if (r instanceof Error) throw r
        return r
      },
    },
  })
  return calls
}
const { beforeEach } = require('node:test')
beforeEach(() => embedder.queryCache.clear())
const reply = (req) => ({ embeddings: req.contents.map(() => ({ values: [3, 0, 4, 0] })) })
const apiError = (status, message) => Object.assign(new Error(message), { status })

test('questions and passages use different task types; vectors come back unit length', async () => {
  const calls = fakeClient(reply)
  const q = await embedder.embedQuery('Шта је фертигација?')
  assert.deepEqual(q, [0.6, 0, 0.8, 0])
  const p = await embedder.embedPassages(['a', 'b'])
  assert.equal(p.length, 2)
  assert.equal(calls[0].config.taskType, 'RETRIEVAL_QUERY')
  assert.equal(calls[1].config.taskType, 'RETRIEVAL_DOCUMENT')
  assert.equal(calls[0].config.outputDimensionality, 4)
  assert.deepEqual(calls[0].contents, ['Šta je fertigacija?'], 'Cyrillic is transliterated before embedding')
})

test('a wrong vector size or count is an error, not stored', async () => {
  fakeClient((req) => ({ embeddings: req.contents.map(() => ({ values: [1, 0] })) }))
  await assert.rejects(embedder.embedQuery('x'), /2 dims, expected 4/)
  fakeClient(() => ({ embeddings: [{ values: [1, 0, 0, 0] }] }))
  await assert.rejects(embedder.embedPassages(['a', 'b'], { backoff: [] }), /1 vectors for 2 texts/)
})

test('query: rate limit surfaces as GeminiRateLimitError; overload is retried once', async () => {
  fakeClient(() => apiError(429, 'RESOURCE_EXHAUSTED'))
  await assert.rejects(embedder.embedQuery('x'), gemini.GeminiRateLimitError)
  const calls = fakeClient((req, n) => (n === 1 ? apiError(503, 'UNAVAILABLE') : reply(req)))
  await embedder.embedQuery('x')
  assert.equal(calls.length, 2)
})

test('ingest: rate limits are waited out, other errors are not', async () => {
  const logs = []
  const calls = fakeClient((req, n) => (n <= 2 ? apiError(429, 'quota') : reply(req)))
  await embedder.embedPassages(['a'], { backoff: [1, 1], log: (m) => logs.push(m) })
  assert.equal(calls.length, 3)
  assert.equal(logs.length, 2)
  const bad = fakeClient(() => apiError(400, 'INVALID_ARGUMENT'))
  await assert.rejects(embedder.embedPassages(['a'], { backoff: [1, 1] }), /INVALID_ARGUMENT/)
  assert.equal(bad.length, 1)
})

test('the daily quota stops the ingest at once with a resumable error', async () => {
  const calls = fakeClient(() => apiError(429, 'Embed content requests per day limit exceeded on Free Tier'))
  await assert.rejects(embedder.embedPassages(['a'], { backoff: [1, 1] }), { name: 'EmbeddingDailyQuotaError' })
  assert.equal(calls.length, 1)
})

test('a repeated question is served from the cache', async () => {
  const calls = fakeClient(reply)
  await embedder.embedQuery('Šta je fertigacija?')
  await embedder.embedQuery('šta je  fertigacija?')
  assert.equal(calls.length, 1)
})
