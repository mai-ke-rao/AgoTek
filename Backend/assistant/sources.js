// Per-request registry of everything the model was shown, so tags can be
// validated against what was actually sent and turned into citations.
//   [S1].. manual chunks (retrieval order, deduplicated by chunk id)
//   [D1].. data tool results (one tag per tool call)

const SNIPPET_CHARS = 300

function pageLabel(chunk, lang) {
  const p = lang === 'en' ? 'p.' : 'str.'
  return chunk.page_end && chunk.page_end !== chunk.page_start
    ? `${p} ${chunk.page_start}–${chunk.page_end}`
    : `${p} ${chunk.page_start}`
}

function manualUrl(chunk) {
  if (chunk.source_url) return chunk.source_url
  if (chunk.source_key) return `/manuals/${encodeURIComponent(chunk.source_key)}#page=${chunk.page_start}`
  return null
}

class SourceRegistry {
  constructor(lang = 'sr') {
    this.lang = lang
    this.byTag = new Map()
    this.tagByChunkId = new Map()
    this.manualCount = 0
    this.dataCount = 0
  }

  addChunk(chunk) {
    const key = String(chunk.id)
    if (this.tagByChunkId.has(key)) return this.tagByChunkId.get(key)
    const tag = `S${++this.manualCount}`
    this.tagByChunkId.set(key, tag)
    this.byTag.set(tag, { tag, kind: 'manual', chunk, text: chunk.content })
    return tag
  }

  // label: human title for the citation chip; appPath: in-app page to open.
  addData(label, payload, appPath = null) {
    const tag = `D${++this.dataCount}`
    this.byTag.set(tag, { tag, kind: 'data', label, appPath, text: `${label}\n${JSON.stringify(payload)}` })
    return tag
  }

  tags() {
    return [...this.byTag.keys()]
  }

  // Map<tag, { kind, text }> for the dose guard.
  texts() {
    return new Map([...this.byTag].map(([tag, s]) => [tag, { kind: s.kind, text: s.text }]))
  }

  formatChunk(tag) {
    const { chunk } = this.byTag.get(tag)
    return `[${tag}] (${chunk.title}, ${pageLabel(chunk, this.lang)})\n${chunk.content}`
  }

  citation(tag) {
    const s = this.byTag.get(tag)
    if (!s) return null
    if (s.kind === 'manual') {
      return {
        tag,
        kind: 'manual',
        documentTitle: s.chunk.title,
        page: s.chunk.page_start,
        pageEnd: s.chunk.page_end,
        sourceUrl: manualUrl(s.chunk),
        snippet: s.chunk.content.slice(0, SNIPPET_CHARS),
      }
    }
    return {
      tag,
      kind: 'data',
      documentTitle: s.label,
      page: null,
      pageEnd: null,
      sourceUrl: s.appPath,
      snippet: s.text.slice(s.label.length + 1, s.label.length + 1 + SNIPPET_CHARS),
    }
  }
}

module.exports = { SourceRegistry, pageLabel }
