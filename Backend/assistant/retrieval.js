const config = require('./config')
const db = require('./db')
const { embedQuery } = require('./embeddings')
const { searchTerms } = require('./text')

// Hybrid retrieval (vector + keyword, fused by rank) with the similarity gate.
//
// Why hybrid: with e5-small, a rare decisive term ("fertigacija") is diluted
// by the generic words around it; on the real corpus the fertigation chapter
// ranked 12th by vector alone for "Kako se izvodi fertigacija u voćnjaku?".
// The keyword side weights terms by rarity (IDF), and reciprocal rank fusion
// combines both lists without having to calibrate their scores.
//
// The gate is unchanged: every returned chunk carries its vector similarity,
// only chunks >= RAG_MIN_SIMILARITY are returned, and `sufficient` is false
// when none is. Keyword hits never bypass the threshold.
//
// Trust boundary: the owner filter (shared corpus OR the caller's own
// documents) is in the WHERE clause of both queries, so another user's
// private chunks are never candidates. userId always comes from the verified
// JWT, never from the model.
//
// pgvector >= 0.8 iterative scans keep filtered HNSW queries from returning
// fewer rows than asked; older versions just skip the setting.

const CANDIDATES = 40
const RRF_K = 60

let iterativeScan = null // detected once

async function supportsIterativeScan() {
  if (iterativeScan === null) {
    const { rows } = await db.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
    const [major, minor] = String(rows[0]?.extversion || '0.0').split('.').map(Number)
    iterativeScan = major > 0 || minor >= 8
  }
  return iterativeScan
}

const FILTER = '(c.owner_user_id IS NULL OR c.owner_user_id = $2) AND c.embedding_model = $3'
const COLUMNS = `c.id, c.document_id, c.chunk_index, c.page_start, c.page_end, c.content,
         d.title, d.source_url, d.source_key,
         1 - (c.embedding <=> $1::vector) AS similarity`

const VECTOR_SQL = `
  SELECT ${COLUMNS}
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
   WHERE ${FILTER}
   ORDER BY c.embedding <=> $1::vector
   LIMIT $4`

// Score = sum of the IDF of the query terms a chunk contains (BM25 without
// the length/tf part; chunks are near-uniform in length).
const KEYWORD_SQL = `
  WITH q AS (SELECT to_tsquery('simple', t) AS tsq FROM unnest($5::text[]) AS t),
  n AS (SELECT count(*)::float AS total FROM chunks c WHERE ${FILTER}),
  w AS (
    SELECT q.tsq, ln(1 + (n.total - df.df + 0.5) / (df.df + 0.5)) AS idf
      FROM q CROSS JOIN n
      CROSS JOIN LATERAL (SELECT count(*)::float AS df FROM chunks c WHERE c.search_tsv @@ q.tsq AND ${FILTER}) df
     WHERE df.df > 0
  ),
  scored AS (
    SELECT c.id, sum(w.idf) AS score
      FROM chunks c JOIN w ON c.search_tsv @@ w.tsq
     WHERE ${FILTER}
     GROUP BY c.id
     ORDER BY score DESC
     LIMIT $4 * 4
  )
  SELECT ${COLUMNS}, s.score
    FROM scored s
    JOIN chunks c ON c.id = s.id
    JOIN documents d ON d.id = c.document_id
   ORDER BY s.score DESC, c.embedding <=> $1::vector
   LIMIT $4`

const normalize = (rows) => rows.map((r) => ({ ...r, similarity: Number(r.similarity) }))

async function vectorSearch(client, params, limit) {
  const { rows } = await client.query(VECTOR_SQL, [...params, limit])
  // relaxed_order may return rows slightly out of order
  return normalize(rows).sort((a, b) => b.similarity - a.similarity)
}

async function keywordSearch(client, params, limit, terms) {
  if (!terms.length) return []
  const { rows } = await client.query(KEYWORD_SQL, [...params, limit, terms])
  return normalize(rows).map(({ score, ...r }) => r)
}

// Reciprocal rank fusion: score = Σ 1 / (RRF_K + rank) over the lists a
// chunk appears in. Pure; exported for tests.
function fuse(lists, k = RRF_K) {
  const byId = new Map()
  for (const list of lists) {
    list.forEach((row, i) => {
      const entry = byId.get(row.id) || { row, score: 0 }
      entry.score += 1 / (k + i + 1)
      byId.set(row.id, entry)
    })
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score || b.row.similarity - a.row.similarity)
    .map((e) => e.row)
}

async function searchChunks(query, vector, userId, k) {
  const relaxed = await supportsIterativeScan()
  const params = [db.toVectorLiteral(vector), String(userId), config.EMBEDDING_MODEL]
  const limit = Math.max(k, CANDIDATES)
  const terms = searchTerms(query)
  const [dense, lexical] = await db.withTransaction(async (client) => {
    if (relaxed) await client.query("SET LOCAL hnsw.iterative_scan = 'relaxed_order'")
    return [await vectorSearch(client, params, limit), await keywordSearch(client, params, limit, terms)]
  })
  return { fused: fuse([dense, lexical]), topSimilarity: dense.length ? dense[0].similarity : null }
}

// Returns { sufficient, chunks (top k, only those >= threshold), topSimilarity }.
async function retrieve(userId, query, { k = config.RAG_TOP_K, minSimilarity = config.RAG_MIN_SIMILARITY } = {}) {
  const vector = await embedQuery(query)
  const { fused, topSimilarity } = await searchChunks(query, vector, userId, k)
  const passing = fused.filter((r) => r.similarity >= minSimilarity).slice(0, k)
  return { sufficient: passing.length > 0, chunks: passing, topSimilarity }
}

module.exports = { retrieve, searchChunks, fuse }
