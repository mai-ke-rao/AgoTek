require('dotenv').config()
const path = require('path')

const num = (value, fallback) => {
  const n = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  // Stored on every chunk; startup refuses to serve retrieval if the stored
  // value differs (a model swap must not silently break search).
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'Xenova/multilingual-e5-small',
  EMBEDDING_DTYPE: process.env.EMBEDDING_DTYPE || 'q8', // quantized ONNX weights
  EMBEDDING_DIM: 384,
  // Inside Backend/ so a model downloaded during the Render build ships with
  // the deploy instead of being re-downloaded on every cold start.
  MODEL_CACHE_DIR: process.env.MODEL_CACHE_DIR || path.join(__dirname, '..', '.model-cache'),

  RAG_TOP_K: num(process.env.RAG_TOP_K, 8),
  // Starting point only: tune with `npm run eval` (see files/ASSISTANT_SPEC.md).
  RAG_MIN_SIMILARITY: num(process.env.RAG_MIN_SIMILARITY, 0.8),

  // Folder with the manuals. Served read-only at /manuals so citation chips
  // can open the PDF at the cited page; absent on Render unless deployed.
  CORPUS_DIR: process.env.RAG_CORPUS_DIR || path.join(__dirname, '..', '..', 'Agricultural_resources'),

  // IOT owns the rules domain; confirmed proposals are created through its API.
  IOT_URL: (process.env.IOT_URL || 'http://localhost:3002').replace(/\/$/, ''),

  MAX_AGENT_STEPS: num(process.env.ASSISTANT_MAX_STEPS, 6),
  RATE_LIMIT_PER_MIN: num(process.env.ASSISTANT_RATE_LIMIT_PER_MIN, 8),
  PROPOSAL_TTL_MINUTES: num(process.env.ASSISTANT_PROPOSAL_TTL_MINUTES, 30),
}
