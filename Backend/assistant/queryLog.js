const db = require('./db')

// One row per question. Rows with path short_circuit or insufficient are the
// shopping list for the next PDFs. No user id is stored.
async function logQuery(row) {
  await db.query(
    `INSERT INTO rag_query_log
       (question, lang, top_similarity, chunks_used, path, pesticide_flag,
        removed_paragraphs, removed_doses, latency_ms, gemini_error, tools_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      row.question, row.lang, row.topSimilarity, row.chunksUsed, row.path, row.pesticideFlag,
      row.removedParagraphs, row.removedDoses, row.latencyMs, row.geminiError, row.toolsUsed || [],
    ]
  )
}

module.exports = { logQuery }
