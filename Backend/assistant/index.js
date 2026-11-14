const config = require('./config')

// Assistant lifecycle. init() runs once after the server starts listening:
// migrate, check that stored chunks were embedded with the configured model,
// warm the embedding model. A failure disables only the assistant (its routes
// answer 503); login, parcels and activities keep working.

const state = { status: 'idle', reason: null, chunkCount: 0 }
let initPromise = null

// Pure: decides from `SELECT embedding_model, count(*) FROM chunks GROUP BY 1`.
function checkEmbeddingModels(rows, configured) {
  const stored = rows.map((r) => r.embedding_model)
  const mismatched = stored.filter((m) => m !== configured)
  if (mismatched.length) {
    return {
      ok: false,
      reason: `chunks were embedded with ${mismatched.join(', ')} but EMBEDDING_MODEL is ${configured}. ` +
        'Truncate chunks and re-run `npm run ingest`, or set EMBEDDING_MODEL back.',
    }
  }
  const chunkCount = rows.reduce((n, r) => n + Number(r.count), 0)
  return { ok: true, chunkCount }
}

async function runInit() {
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')

  const db = require('./db')
  await require('./migrate').migrate()

  const { rows } = await db.query('SELECT embedding_model, count(*) AS count FROM chunks GROUP BY embedding_model')
  const check = checkEmbeddingModels(rows, config.EMBEDDING_MODEL)
  if (!check.ok) throw new Error(check.reason)
  state.chunkCount = check.chunkCount
  if (check.chunkCount === 0) {
    console.warn('assistant: no manual chunks yet — run `npm run ingest`. Manual questions will be answered "not in my sources".')
  }

  // Load once, at startup, and prove the output shape.
  await require('./embeddings').embedQuery('warm-up')
}

function init() {
  if (!initPromise) {
    state.status = 'starting'
    const started = Date.now()
    initPromise = runInit()
      .then(() => {
        state.status = 'ready'
        const rss = Math.round(process.memoryUsage().rss / 1024 / 1024)
        console.log(`assistant ready in ${Date.now() - started} ms (${state.chunkCount} chunks, rss ${rss} MB)`)
      })
      .catch((err) => {
        state.status = 'disabled'
        state.reason = err.message
        console.error('assistant DISABLED:', err.message)
      })
  }
  return initPromise
}

// For request handlers: waits for a startup still in progress.
async function ready() {
  if (state.status === 'idle') init()
  if (state.status === 'starting') await initPromise
  return state.status === 'ready'
}

module.exports = { init, ready, state, checkEmbeddingModels }
