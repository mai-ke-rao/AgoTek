const fs = require('fs')
const path = require('path')
const { getPool } = require('./db')

// Applies assistant/migrations/*.sql in name order, once each, tracked in
// assistant_migrations. Runs at startup (Render free has no pre-deploy hook)
// and via `npm run db:migrate`. Everything runs in one transaction holding a
// transaction-scoped advisory lock, so two instances never migrate at once.
// (A session-level lock would break behind a transaction pooler such as
// Neon's "-pooler" endpoint: lock and unlock can land on different server
// connections.) All pending files commit together or not at all.

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')
const LOCK_ID = 7331001

async function migrate({ log = console.log } = {}) {
  const client = await getPool().connect()
  const appliedNow = []
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID])
    await client.query(`CREATE TABLE IF NOT EXISTS assistant_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
    const { rows } = await client.query('SELECT name FROM assistant_migrations')
    const applied = new Set(rows.map((r) => r.name))

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      try {
        await client.query(sql)
      } catch (err) {
        throw new Error(`migration ${file} failed: ${err.message}`)
      }
      await client.query('INSERT INTO assistant_migrations (name) VALUES ($1)', [file])
      appliedNow.push(file)
    }
    await client.query('COMMIT')
    for (const file of appliedNow) log(`assistant migration applied: ${file}`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// The vector column has a fixed size. When the embedding model changes to one
// with another size (e5-small 384 → gemini-embedding-001 768) the old vectors
// are useless anyway: drop them, resize the column, rebuild the index.
// Startup calls this only for an empty table; `npm run ingest` passes
// deleteChunks (chunks are derived data, and that run re-creates them).
// Returns true when the column has the configured size afterwards.
async function ensureVectorDim({ deleteChunks = false, log = console.log } = {}) {
  const config = require('./config')
  const db = require('./db')
  const wanted = config.EMBEDDING_DIM
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > 2000) throw new Error(`invalid EMBEDDING_DIM ${wanted}`)
  const current = await db.embeddingColumnDim()
  if (current === wanted) return true
  const { rows } = await db.query('SELECT count(*)::int AS n FROM chunks')
  if (rows[0].n > 0 && !deleteChunks) return false
  log(`resizing chunks.embedding from ${current} to ${wanted} dims (${config.EMBEDDING_MODEL})` +
    (rows[0].n ? `; ${rows[0].n} chunks will be re-embedded` : ''))
  await db.withTransaction(async (client) => {
    await client.query('DROP INDEX IF EXISTS chunks_embedding_hnsw_idx')
    await client.query('DELETE FROM chunks')
    await client.query(`ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(${wanted})`)
    await client.query('CREATE INDEX chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops)')
  })
  return true
}

module.exports = { migrate, ensureVectorDim }
