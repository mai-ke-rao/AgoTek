// Chunking: headings and paragraphs first, ~350 tokens per chunk (e5-small
// truncates at 512), ~60 tokens of overlap, never across documents (called
// per document). Token counts come from the real tokenizer (countTokens).
//
// blocks: [{ text, page, pageEnd, heading }]
// returns: [{ content, pageStart, pageEnd }]

const SENTENCE_SPLIT = /(?<=[.!?…])\s+(?=[\p{Lu}\d„"«(])/u

async function splitOversize(block, countTokens, target) {
  const sentences = block.text.split(SENTENCE_SPLIT)
  const pieces = []
  let cur = ''
  const push = (text) => text && pieces.push({ ...block, text, heading: false })

  for (const sentence of sentences) {
    if ((await countTokens(sentence)) > target) {
      push(cur)
      cur = ''
      // A single giant "sentence" (tables, lists without punctuation): by words.
      const words = sentence.split(' ')
      let w = ''
      for (const word of words) {
        const candidate = w ? `${w} ${word}` : word
        if (w && (await countTokens(candidate)) > target) {
          push(w)
          w = word
        } else {
          w = candidate
        }
      }
      push(w)
      continue
    }
    const candidate = cur ? `${cur} ${sentence}` : sentence
    if (cur && (await countTokens(candidate)) > target) {
      push(cur)
      cur = sentence
    } else {
      cur = candidate
    }
  }
  push(cur)
  return pieces
}

// Trailing sentences of the previous chunk, up to `overlap` tokens.
async function overlapTail(units, overlap, countTokens) {
  const sentences = units.filter((u) => !u.heading).flatMap((u) =>
    u.text.split(SENTENCE_SPLIT).map((text) => ({ ...u, text }))
  )
  const tail = []
  let tokens = 0
  for (let i = sentences.length - 1; i >= 0; i--) {
    const t = await countTokens(sentences[i].text)
    if (tokens + t > overlap) break
    tail.unshift(sentences[i])
    tokens += t
  }
  return { units: tail, tokens }
}

async function chunkBlocks(blocks, { countTokens, target = 350, overlap = 60 }) {
  const units = []
  for (const block of blocks) {
    const tokens = await countTokens(block.text)
    if (block.heading || tokens <= target) units.push({ ...block, tokens })
    else {
      for (const piece of await splitOversize(block, countTokens, target)) {
        units.push({ ...piece, tokens: await countTokens(piece.text) })
      }
    }
  }

  const chunks = []
  let cur = []
  let curTokens = 0

  const emit = () => {
    if (!cur.some((u) => !u.heading)) return false // headings alone wait for content
    chunks.push({
      content: cur.map((u) => u.text).join('\n'),
      pageStart: Math.min(...cur.map((u) => u.page)),
      pageEnd: Math.max(...cur.map((u) => u.pageEnd || u.page)),
    })
    return true
  }

  for (const unit of units) {
    // A heading opens a new section: close the current chunk, no overlap.
    if (unit.heading && curTokens >= target * 0.4 && emit()) {
      cur = []
      curTokens = 0
    } else if (curTokens + unit.tokens > target && emit()) {
      const tail = await overlapTail(cur, overlap, countTokens)
      cur = tail.tokens + unit.tokens <= target ? tail.units : []
      curTokens = cur.length ? tail.tokens : 0
    }
    cur.push(unit)
    curTokens += unit.tokens
  }
  emit()

  return chunks.filter((c) => c.content.replace(/\s/g, '').length >= 40)
}

module.exports = { chunkBlocks }
