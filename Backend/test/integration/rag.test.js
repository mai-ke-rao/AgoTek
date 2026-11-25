// npm run test:integration — needs DATABASE_URL (pgvector; e.g. IOT's
// docker compose) and downloads the embedding model on first run. Uses the
// real corpus in Agricultural_resources. Point DATABASE_URL at a dev
// database: these tests ingest into it.
require('dotenv').config()
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const config = require('../../assistant/config')

const skip = !config.DATABASE_URL && 'DATABASE_URL not set'
const SMALL = 'praktikum' // 93 pages, the fastest document to ingest

let db, ingestDirectory, retrieve, migrate
before(async () => {
  if (skip) return
  db = require('../../assistant/db')
  ;({ ingestDirectory } = require('../../assistant/ingest/run'))
  ;({ retrieve } = require('../../assistant/retrieval'))
  ;({ migrate } = require('../../assistant/migrate'))
  await migrate({ log: () => {} })
})
after(async () => { if (db) await db.close() })

test('ingest is idempotent', { skip, timeout: 30 * 60_000 }, async () => {
  const [first] = await ingestDirectory({ only: SMALL, log: () => {} })
  assert.ok(first.chunks > 20, `expected a real chunk count, got ${first.chunks}`)
  const [second] = await ingestDirectory({ only: SMALL, log: () => {} })
  assert.equal(second.embedded, 0)
  assert.equal(second.deleted, 0)
  assert.equal(second.chunks, first.chunks)
  const { rows } = await db.query(
    'SELECT count(*)::int AS n FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.source_key ILIKE $1',
    [`%${SMALL}%`]
  )
  assert.equal(rows[0].n, first.chunks)
})

test('Serbian (Latin and Cyrillic) and English questions retrieve the same Cyrillic manual', { skip, timeout: 30 * 60_000 }, async () => {
  await ingestDirectory({ only: 'Primena_djubriva', log: () => {} })
  for (const q of [
    'Kako se izvodi fertigacija u voćnjaku?',
    'Како се изводи фертигација у воћњаку?',
    'How is fertigation done in an orchard?',
  ]) {
    const r = await retrieve('integration-user', q, { minSimilarity: 0 })
    assert.ok(r.chunks.some((c) => c.source_key === 'Primena_djubriva_Udzbenik.pdf'), q)
    console.log(`  top similarity ${r.topSimilarity.toFixed(3)} for: ${q}`)
  }
})

test("another user's private document is never retrieved", { skip }, async () => {
  const { embedPassages } = require('../../assistant/embeddings')
  const text = 'Tajni plan navodnjavanja parcele Severna livada: zalivati svake noći.'
  const [vector] = await embedPassages([text])
  const { rows: [doc] } = await db.query(
    `INSERT INTO documents (source_key, title, owner_user_id) VALUES ('private-test.pdf', 'Private', 'owner-a')
     ON CONFLICT (source_key) DO UPDATE SET owner_user_id = 'owner-a' RETURNING id`
  )
  await db.query(
    `INSERT INTO chunks (document_id, owner_user_id, chunk_index, page_start, page_end, content, content_hash, embedding, embedding_model, search_text)
     VALUES ($1, 'owner-a', 0, 1, 1, $2, 'private-test-hash', $3::vector, $4, $5) ON CONFLICT (content_hash) DO NOTHING`,
    [doc.id, text, db.toVectorLiteral(vector), config.EMBEDDING_MODEL, require('../../assistant/text').toSearchText(text)]
  )
  try {
    const mine = await retrieve('owner-a', 'plan navodnjavanja Severna livada', { minSimilarity: 0 })
    assert.ok(mine.chunks.some((c) => c.content === text))
    const theirs = await retrieve('owner-b', 'plan navodnjavanja Severna livada', { minSimilarity: 0 })
    assert.ok(!theirs.chunks.some((c) => c.content === text))
  } finally {
    await db.query("DELETE FROM documents WHERE source_key = 'private-test.pdf'")
  }
})
