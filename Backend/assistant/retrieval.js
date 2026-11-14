const config = require('./config')
const db = require('./db')
const { embedQuery } = require('./embeddings')

// Vector search with the similarity gate.
//
// Trust boundary: the owner filter (shared corpus OR the caller's own
// documents) is part of the SQL WHERE clause, evaluated inside the index scan,
// so another user's private chunks are never candidates. userId always comes
// from the verified JWT, never from the model.
//
// pgvector >= 0.8 iterative scans keep filtered HNSW queries from returning
// fewer than k rows; older versions just skip the setting.

let iterativeScan = null // detected once

async function supportsIterativeScan() {
  if (iterativeScan === null) {
    const { rows } = await db.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
    const [major, minor] = String(rows[0]?.extversion || '0.0').split('.').map(Number)
    iterativeScan = major > 0 || minor >= 8
  }
  return iterativeScan
}

const SEARCH_SQL = `
  SELECT c.id, c.document_id, c.chunk_index, c.page_start, c.page_end, c.content,
         d.title, d.source_url, d.source_key,
         1 - (c.embedding <=> $1::vector) AS similarity
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
   WHERE (c.owner_user_id IS NULL OR c.owner_user_id = $2)
     AND c.embedding_model = $3
   ORDER BY c.embedding <=> $1::vector
   LIMIT $4`

async function searchChunks(vector, userId, k) {
  const relaxed = await supportsIterativeScan()
  return db.withTransaction(async (client) => {
    if (relaxed) await client.query("SET LOCAL hnsw.iterative_scan = 'relaxed_order'")
    const { rows } = await client.query(SEARCH_SQL, [
      db.toVectorLiteral(vector), String(userId), config.EMBEDDING_MODEL, k,
    ])
    // relaxed_order may return rows slightly out of order
    return rows
      .map((r) => ({ ...r, similarity: Number(r.similarity) }))
      .sort((a, b) => b.similarity - a.similarity)
  })
}

// Returns { sufficient, chunks (only those >= threshold), topSimilarity }.
async function retrieve(userId, query, { k = config.RAG_TOP_K, minSimilarity = config.RAG_MIN_SIMILARITY } = {}) {
  const vector = await embedQuery(query)
  const rows = await searchChunks(vector, userId, k)
  const passing = rows.filter((r) => r.similarity >= minSimilarity)
  return {
    sufficient: passing.length > 0,
    chunks: passing,
    topSimilarity: rows.length ? rows[0].similarity : null,
  }
}

module.exports = { retrieve, searchChunks }
