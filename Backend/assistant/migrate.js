const fs = require('fs')
const path = require('path')
const { getPool } = require('./db')

// Applies assistant/migrations/*.sql in name order, once each, tracked in
// assistant_migrations. Runs at startup (Render free has no pre-deploy hook)
// and via `npm run db:migrate`. An advisory lock keeps two instances from
// migrating at once.

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')
const LOCK_ID = 7331001

async function migrate({ log = console.log } = {}) {
  const client = await getPool().connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID])
    await client.query(`CREATE TABLE IF NOT EXISTS assistant_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
    const { rows } = await client.query('SELECT name FROM assistant_migrations')
    const applied = new Set(rows.map((r) => r.name))

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO assistant_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        log(`assistant migration applied: ${file}`)
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw new Error(`migration ${file} failed: ${err.message}`)
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {})
    client.release()
  }
}

module.exports = { migrate }
