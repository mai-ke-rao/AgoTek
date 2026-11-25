#!/usr/bin/env node
// npm run ingest -- [corpusDir] [--only <file substring>] [--owner <userId>]
// Run locally against the production DATABASE_URL; never on Render.
require('dotenv').config()
const path = require('path')
const { ingestDirectory } = require('../assistant/ingest/run')
const db = require('../assistant/db')

function parseArgs(argv) {
  const out = { dir: undefined, only: null, owner: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') out.only = argv[++i]
    else if (argv[i] === '--owner') out.owner = argv[++i]
    else out.dir = path.resolve(argv[i])
  }
  return out
}

const started = Date.now()
ingestDirectory(parseArgs(process.argv.slice(2)))
  .then((results) => {
    const total = results.reduce((n, r) => n + r.chunks, 0)
    const embedded = results.reduce((n, r) => n + r.embedded, 0)
    console.log(`done in ${Math.round((Date.now() - started) / 1000)} s: ${results.length} documents, ${total} chunks, ${embedded} newly embedded`)
  })
  .catch((err) => {
    // Expected on the free tier with a large corpus: not a crash, just "continue tomorrow".
    if (err && err.name === 'EmbeddingDailyQuotaError') console.error(`ingest paused: ${err.message}`)
    else console.error('ingest failed:', err)
    process.exitCode = 1
  })
  .finally(() => db.close())
