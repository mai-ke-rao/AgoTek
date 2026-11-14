const { Pool } = require('pg')
const config = require('./config')

// Same Postgres as IOT (rules domain) plus the assistant's own tables.
let pool = null

function getPool() {
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  if (!pool) {
    pool = new Pool({ connectionString: config.DATABASE_URL, max: 5 })
    pool.on('error', (err) => console.error('assistant pg pool error:', err.message))
  }
  return pool
}

function query(text, params) {
  return getPool().query(text, params)
}

async function withTransaction(fn) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

function toVectorLiteral(vector) {
  return `[${vector.join(',')}]`
}

async function close() {
  if (pool) {
    const p = pool
    pool = null
    await p.end()
  }
}

module.exports = { getPool, query, withTransaction, toVectorLiteral, close }
