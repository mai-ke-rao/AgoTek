const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const config = require('../config')
const db = require('../db')
const { migrate } = require('../migrate')
const { embedPassages, countTokens } = require('../embeddings')
const { extractPages } = require('./pdf')
const { cleanPages } = require('./clean')
const { chunkBlocks } = require('./chunk')

// Idempotent corpus ingestion (run locally, never on Render):
//   - documents are upserted by source_key (the file name)
//   - chunks are keyed by content_hash = sha256(source_key + content); a hash
//     already stored with the current model is not re-embedded
//   - chunks of a document that no longer come out of the chunker are deleted
// A second run over unchanged PDFs embeds nothing and changes nothing.

const BATCH = 16
const LOW_TEXT_CHARS = 80

function hashOf(sourceKey, content) {
  return crypto.createHash('sha256').update(`${sourceKey}\n${content}`).digest('hex')
}

function readManifest(dir) {
  const file = path.join(dir, 'sources.json')
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
}

async function upsertDocument(sourceKey, meta, pageCount, owner) {
  const { rows } = await db.query(
    `INSERT INTO documents (source_key, title, source_url, language, publisher, year, owner_user_id, page_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (source_key) DO UPDATE SET
       title = EXCLUDED.title, source_url = EXCLUDED.source_url, language = EXCLUDED.language,
       publisher = EXCLUDED.publisher, year = EXCLUDED.year,
       owner_user_id = EXCLUDED.owner_user_id, page_count = EXCLUDED.page_count
     RETURNING id`,
    [sourceKey, meta.title, meta.sourceUrl || null, meta.language || null, meta.publisher || null,
      meta.year || null, owner, pageCount]
  )
  return rows[0].id
}

async function ingestFile(file, { meta, owner, log }) {
  const sourceKey = path.basename(file)
  const pages = await extractPages(fs.readFileSync(file))

  const lowText = pages.filter((p) => p.lines.reduce((n, l) => n + l.text.length, 0) < LOW_TEXT_CHARS)
  if (lowText.length) {
    log(`  ${lowText.length}/${pages.length} pages have almost no text layer (scanned? needs OCR): ` +
      lowText.slice(0, 15).map((p) => p.page).join(', ') + (lowText.length > 15 ? ', …' : ''))
  }

  const blocks = cleanPages(pages)
  const chunks = await chunkBlocks(blocks, { countTokens, target: 350, overlap: 60 })

  // The same text twice in one document collapses to one chunk.
  const unique = new Map()
  chunks.forEach((c) => {
    const hash = hashOf(sourceKey, c.content)
    if (!unique.has(hash)) unique.set(hash, { ...c, hash })
  })
  const rows = [...unique.values()].map((c, i) => ({ ...c, index: i }))

  const documentId = await upsertDocument(sourceKey, meta, pages.length, owner)
  const existing = await db.query('SELECT content_hash, embedding_model FROM chunks WHERE document_id = $1', [documentId])
  const current = new Set(existing.rows.filter((r) => r.embedding_model === config.EMBEDDING_MODEL).map((r) => r.content_hash))

  const toEmbed = rows.filter((r) => !current.has(r.hash))
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH)
    const vectors = await embedPassages(batch.map((r) => r.content))
    await db.withTransaction(async (client) => {
      for (let j = 0; j < batch.length; j++) {
        const r = batch[j]
        await client.query(
          `INSERT INTO chunks (document_id, owner_user_id, chunk_index, page_start, page_end, content,
                              content_hash, embedding, embedding_model)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
           ON CONFLICT (content_hash) DO UPDATE SET
             document_id = EXCLUDED.document_id, owner_user_id = EXCLUDED.owner_user_id,
             chunk_index = EXCLUDED.chunk_index, page_start = EXCLUDED.page_start,
             page_end = EXCLUDED.page_end, embedding = EXCLUDED.embedding,
             embedding_model = EXCLUDED.embedding_model`,
          [documentId, owner, r.index, r.pageStart, r.pageEnd, r.content, r.hash,
            db.toVectorLiteral(vectors[j]), config.EMBEDDING_MODEL]
        )
      }
    })
    log(`  embedded ${Math.min(i + BATCH, toEmbed.length)}/${toEmbed.length}`)
  }

  // Unchanged chunks may still have moved (index/pages, owner): update only those that differ.
  await db.withTransaction(async (client) => {
    for (const r of rows.filter((x) => current.has(x.hash))) {
      await client.query(
        `UPDATE chunks SET chunk_index = $2, page_start = $3, page_end = $4, owner_user_id = $5
          WHERE content_hash = $1 AND (chunk_index, page_start, page_end) IS DISTINCT FROM ($2, $3, $4)
             OR content_hash = $1 AND owner_user_id IS DISTINCT FROM $5`,
        [r.hash, r.index, r.pageStart, r.pageEnd, owner]
      )
    }
  })

  const stale = await db.query(
    'DELETE FROM chunks WHERE document_id = $1 AND NOT (content_hash = ANY($2::text[]))',
    [documentId, rows.map((r) => r.hash)]
  )

  return { sourceKey, pages: pages.length, chunks: rows.length, embedded: toEmbed.length, deleted: stale.rowCount }
}

async function ingestDirectory({ dir = config.CORPUS_DIR, owner = null, only = null, log = console.log } = {}) {
  await migrate({ log })
  const manifest = readManifest(dir)
  const files = fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .filter((f) => !only || f.toLowerCase().includes(only.toLowerCase()))
    .sort()
  if (!files.length) throw new Error(`no PDFs found in ${dir}`)

  const results = []
  for (const f of files) {
    const meta = { title: f.replace(/\.pdf$/i, ''), ...(manifest[f] || {}) }
    log(`ingesting ${f} → "${meta.title}"`)
    const r = await ingestFile(path.join(dir, f), { meta, owner, log })
    log(`  ${r.pages} pages, ${r.chunks} chunks, ${r.embedded} embedded, ${r.deleted} stale deleted`)
    results.push(r)
  }
  return results
}

module.exports = { ingestDirectory, hashOf }
