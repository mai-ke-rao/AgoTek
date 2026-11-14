#!/usr/bin/env node
// npm run model:download — fetch the quantized embedding model into
// .model-cache during the Render build so startup doesn't download ~120 MB.
// Render build command: npm install && npm run model:download
require('dotenv').config()
const config = require('../assistant/config')
const { embedQuery } = require('../assistant/embeddings')

embedQuery('warm-up')
  .then((v) => console.log(`${config.EMBEDDING_MODEL} (${config.EMBEDDING_DTYPE}) cached in ${config.MODEL_CACHE_DIR}, ${v.length} dims`))
  .catch((err) => {
    console.error('model download failed:', err)
    process.exitCode = 1
  })
