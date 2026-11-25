require('dotenv').config()
const path = require('path')

const num = (value, fallback) => {
  const n = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback
}

const provider = (process.env.EMBEDDING_PROVIDER || 'gemini').toLowerCase()
const EMBEDDING_DEFAULTS = {
  // minSimilarity: each model has its own score scale (e5 packs everything
  // into 0.80-0.90; gemini-embedding-001 spreads related ~0.65-0.75 and
  // unrelated ~0.40-0.57). Starting points; tune with `npm run eval`.
  gemini: { model: 'gemini-embedding-001', dim: 768, minSimilarity: 0.62 },
  local: { model: 'Xenova/multilingual-e5-small', dim: 384, minSimilarity: 0.8 },
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  // Defaults chosen for the free tier (measured Nov 2026): 3.5-flash allows 20
  // requests a day, 3.7/3.8-flash refuse free traffic ("high demand"), the
  // flash-lite models have their own, larger quotas. With billing enabled set
  // GEMINI_MODEL=gemini-3.8-flash.
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  // Comma-separated, tried in order when a model is overloaded, times out or
  // is out of quota; empty disables.
  GEMINI_FALLBACK_MODELS: (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.5-flash-lite,gemini-3.1-flash-lite')
    .split(',').map((m) => m.trim()).filter(Boolean),

  // 'gemini': embeddings API (no model in the process; fits a 512 MB host).
  // 'local': e5-small via transformers.js in-process (~500 MB of RAM).
  EMBEDDING_PROVIDER: provider,
  // Stored on every chunk; startup refuses to serve retrieval if the stored
  // value differs (a model swap must not silently break search).
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || EMBEDDING_DEFAULTS[provider]?.model,
  // Must match the chunks.embedding column; `npm run ingest` resizes the
  // column (and re-embeds everything) when this changes.
  EMBEDDING_DIM: num(process.env.EMBEDDING_DIM, EMBEDDING_DEFAULTS[provider]?.dim),
  EMBEDDING_DTYPE: process.env.EMBEDDING_DTYPE || 'q8', // local only: quantized ONNX weights
  MODEL_CACHE_DIR: process.env.MODEL_CACHE_DIR || path.join(__dirname, '..', '.model-cache'), // local only

  RAG_TOP_K: num(process.env.RAG_TOP_K, 8),
  // Starting point only: tune with `npm run eval` (see files/ASSISTANT_SPEC.md).
  RAG_MIN_SIMILARITY: num(process.env.RAG_MIN_SIMILARITY, EMBEDDING_DEFAULTS[provider]?.minSimilarity ?? 0.8),

  // Folder with the manuals. Served read-only at /manuals so citation chips
  // can open the PDF at the cited page; absent on Render unless deployed.
  CORPUS_DIR: process.env.RAG_CORPUS_DIR || path.join(__dirname, '..', '..', 'Agricultural_resources'),

  // IOT owns the rules domain; confirmed proposals are created through its API.
  IOT_URL: (process.env.IOT_URL || 'http://localhost:3002').replace(/\/$/, ''),

  MAX_AGENT_STEPS: num(process.env.ASSISTANT_MAX_STEPS, 6),
  GEMINI_TIMEOUT_MS: num(process.env.GEMINI_TIMEOUT_MS, 30000), // per Gemini call; a timeout answers 503
  RATE_LIMIT_PER_MIN: num(process.env.ASSISTANT_RATE_LIMIT_PER_MIN, 8),
  PROPOSAL_TTL_MINUTES: num(process.env.ASSISTANT_PROPOSAL_TTL_MINUTES, 30),
}
