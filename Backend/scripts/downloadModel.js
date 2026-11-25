#!/usr/bin/env node
// npm run model:download — EMBEDDING_PROVIDER=local only: fetch the quantized
// embedding model into .model-cache so startup doesn't download ~120 MB.
// Not needed with the default gemini provider.
require('dotenv').config()
const config = require('../assistant/config')
const { embedQuery } = require('../assistant/embeddings')

if (config.EMBEDDING_PROVIDER !== 'local') {
  console.log(`EMBEDDING_PROVIDER is ${config.EMBEDDING_PROVIDER}: nothing to download`)
  process.exit(0)
}

embedQuery('warm-up')
  .then((v) => console.log(`${config.EMBEDDING_MODEL} (${config.EMBEDDING_DTYPE}) cached in ${config.MODEL_CACHE_DIR}, ${v.length} dims`))
  .catch((err) => {
    console.error('model download failed:', err)
    process.exitCode = 1
  })
