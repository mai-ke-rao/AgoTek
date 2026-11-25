const { test } = require('node:test')
const assert = require('node:assert/strict')
const config = require('../../assistant/config')
const gemini = require('../../assistant/gemini')

config.GEMINI_MODEL = 'primary'
config.GEMINI_FALLBACK_MODELS = ['fallback']

const ok = { candidates: [{ content: { role: 'model', parts: [{ text: 'x' }] } }], functionCalls: [] }
const apiError = (status, message) => Object.assign(new Error(message), { status })

function fakeClient(behaviour) {
  const calls = []
  gemini.setClientForTests({
    models: {
      generateContent: async (req) => {
        calls.push(req.model)
        const r = behaviour(req.model, calls.length)
        if (r instanceof Error) throw r
        return r
      },
    },
  })
  return calls
}

const req = (session) => ({ systemInstruction: 's', contents: [], functionDeclarations: [], session })

test('overloaded primary is retried once, then the fallback answers and is pinned for the question', async () => {
  const calls = fakeClient((model) => (model === 'primary' ? apiError(503, 'high demand') : ok))
  const session = {}
  await gemini.generate(req(session))
  assert.deepEqual(calls, ['primary', 'primary', 'fallback'])
  assert.equal(session.model, 'fallback')
  await gemini.generate(req(session))
  assert.deepEqual(calls.slice(3), ['fallback'], 'later steps stay on the pinned model')
})

test('a transient overload succeeds on the retry without the fallback', async () => {
  const calls = fakeClient((model, n) => (n === 1 ? apiError(503, 'UNAVAILABLE') : ok))
  const session = {}
  await gemini.generate(req(session))
  assert.deepEqual(calls, ['primary', 'primary'])
  assert.equal(session.model, 'primary')
})

test('a timeout is not retried on the same model but falls over to the fallback', async () => {
  const abort = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })
  const calls = fakeClient((model) => (model === 'primary' ? abort : ok))
  const session = {}
  await gemini.generate(req(session))
  assert.deepEqual(calls, ['primary', 'fallback'])
  assert.equal(session.model, 'fallback')
})

test('other errors (bad request) fail at once, no retry or fallback', async () => {
  const calls = fakeClient(() => apiError(400, 'INVALID_ARGUMENT'))
  await assert.rejects(gemini.generate(req({})), /INVALID_ARGUMENT/)
  assert.deepEqual(calls, ['primary'])
})

test('rate limited on every model → GeminiRateLimitError (the 429 path)', async () => {
  const calls = fakeClient(() => apiError(429, 'RESOURCE_EXHAUSTED'))
  await assert.rejects(gemini.generate(req({})), gemini.GeminiRateLimitError)
  assert.deepEqual(calls, ['primary', 'fallback'])
})

test('rate limited in the middle of a question: the other model takes over', async () => {
  const calls = fakeClient((model, n) => (model === 'primary' && n > 1 ? apiError(429, 'RESOURCE_EXHAUSTED') : ok))
  const session = {}
  await gemini.generate(req(session))
  await gemini.generate(req(session))
  assert.deepEqual(calls, ['primary', 'primary', 'fallback'])
  assert.equal(session.model, 'fallback')
})

test('a model that just failed is skipped on the next question (cooldown)', async () => {
  const calls = fakeClient((model) => (model === 'primary' ? apiError(429, 'quota. Please retry in 6h41m36.3s.') : ok))
  await gemini.generate(req({}))
  await gemini.generate(req({}))
  assert.deepEqual(calls, ['primary', 'fallback', 'fallback'])
})

test('every model over its per-minute limit: the shortest wait is waited out', async () => {
  let n = 0
  const calls = fakeClient(() => (++n <= 2 ? apiError(429, 'RESOURCE_EXHAUSTED "retryDelay":"0.01s"') : ok))
  await gemini.generate(req({}))
  assert.deepEqual(calls, ['primary', 'fallback', 'primary'])
})

test('retry delay parsing', () => {
  assert.equal(gemini.retryDelayMs(new Error('Please retry in 6h41m36.351478792s.')), 24096352)
  assert.equal(gemini.retryDelayMs(new Error('{"retryDelay":"48s"}')), 48000)
  assert.equal(gemini.retryDelayMs(new Error('nope')), null)
})
