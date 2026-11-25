const config = require('./config')

// Embedding provider switch (EMBEDDING_PROVIDER): 'gemini' (API, default) or
// 'local' (transformers.js e5-small in-process, ~500 MB of RAM). Vectors from
// different models are not comparable: every chunk stores its embedding_model
// and startup refuses to search a corpus embedded with another one.

const PROVIDERS = {
  gemini: () => require('./embedders/gemini'),
  local: () => require('./embedders/local'),
}

function provider() {
  const load = PROVIDERS[config.EMBEDDING_PROVIDER]
  if (!load) throw new Error(`unknown EMBEDDING_PROVIDER "${config.EMBEDDING_PROVIDER}" (use gemini or local)`)
  return load()
}

module.exports = {
  embedQuery: (text) => provider().embedQuery(text),
  embedPassages: (texts, options) => provider().embedPassages(texts, options),
  countTokens: (text) => provider().countTokens(text),
}
