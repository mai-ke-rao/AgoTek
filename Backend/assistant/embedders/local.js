const config = require('../config')
const { toEmbeddingText } = require('../text')

// EMBEDDING_PROVIDER=local: Xenova/multilingual-e5-small via transformers.js,
// quantized (q8) weights, in-process. Needs ~500 MB of RAM, so production
// uses the gemini provider; this one is for offline development.
// Loaded once per process and shared. e5 needs "query: " / "passage: "
// prefixes, mean pooling and normalized vectors; both sides are transliterated
// to Latin script (toEmbeddingText) so Cyrillic manuals match Latin questions.

let extractorPromise = null

function loadExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.cacheDir = config.MODEL_CACHE_DIR
      return pipeline('feature-extraction', config.EMBEDDING_MODEL, { dtype: config.EMBEDDING_DTYPE })
    })()
    extractorPromise.catch(() => { extractorPromise = null }) // allow a retry
  }
  return extractorPromise
}

async function embed(texts, prefix) {
  const extractor = await loadExtractor()
  const inputs = texts.map((t) => prefix + toEmbeddingText(t))
  const output = await extractor(inputs, { pooling: 'mean', normalize: true })
  const vectors = output.tolist()
  for (const v of vectors) {
    if (v.length !== config.EMBEDDING_DIM) {
      throw new Error(`embedding has ${v.length} dims, expected ${config.EMBEDDING_DIM}`)
    }
  }
  return vectors
}

async function embedQuery(text) {
  const [vector] = await embed([text], 'query: ')
  return vector
}

function embedPassages(texts) {
  return embed(texts, 'passage: ')
}

// Real tokenizer count (XLM-R sentencepiece), used by the chunker so chunks
// stay under e5's 512-token truncation.
async function countTokens(text) {
  const extractor = await loadExtractor()
  return extractor.tokenizer.encode('passage: ' + toEmbeddingText(text)).length
}

module.exports = { embedQuery, embedPassages, countTokens }
