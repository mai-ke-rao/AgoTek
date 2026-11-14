// Turns extracted lines into cleaned blocks: drops headers/footers repeated
// across pages and bare page numbers, joins words hyphenated at line breaks,
// collapses whitespace, and marks headings. Pure; see test/unit/ingest.test.js.
//
// Output: [{ text, page, heading }]

const EDGE_LINES = 3
const PAGE_NUMBER = /^[\s\-–—|]*\d{1,4}[\s\-–—|]*$/
const NUMBERED_HEADING = /^\d+(\.\d+)*\.?\s+\S/
const LIST_START = /^(?:[-–•*]|\d{1,2}[.)]|[a-zа-я][.)])\s+/i
const TERMINAL = /[.!?:;…"»”]$/ // not ")": headings like "4.1.1. Азот (N)"

const collapse = (s) => s.replace(/\s+/g, ' ').trim()
const edgeKey = (s) => collapse(s).toLowerCase().replace(/\d+/g, '#')

function repeatedEdgeKeys(pages) {
  const counts = new Map()
  for (const p of pages) {
    const edges = new Set([...p.lines.slice(0, EDGE_LINES), ...p.lines.slice(-EDGE_LINES)].map((l) => edgeKey(l.text)))
    for (const k of edges) counts.set(k, (counts.get(k) || 0) + 1)
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.3))
  return new Set([...counts].filter(([k, n]) => n >= threshold && k.length > 1).map(([k]) => k))
}

function isHeading(text) {
  if (text.length > 90 || TERMINAL.test(text)) return false
  if (NUMBERED_HEADING.test(text) && !/^\d+([.,]\d+)?\s*(%|kg|g|l|t|cm|mm|m)\b/i.test(text)) return true
  const letters = text.match(/\p{L}/gu) || []
  if (letters.length < 4) return false
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length
  return upper / letters.length >= 0.7
}

// "đubri-" + "va" → "đubriva"; a hyphen before an uppercase letter or digit
// is a real hyphen ("N-P-K", "Pre-Harvest").
function joinLines(a, b) {
  if (/\p{L}-$/u.test(a) && /^\p{Ll}/u.test(b)) return a.slice(0, -1) + b
  return `${a} ${b}`
}

function median(values) {
  if (!values.length) return 0
  const s = [...values].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

function pageBlocks(page, repeated) {
  const lines = page.lines
    .map((l, i) => ({ ...l, text: collapse(l.text), edge: i < EDGE_LINES || i >= page.lines.length - EDGE_LINES }))
    .filter((l) => l.text && !(l.edge && (repeated.has(edgeKey(l.text)) || PAGE_NUMBER.test(l.text))))

  const gaps = []
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y // pdf y grows upward
    if (g > 0) gaps.push(g)
  }
  const typicalGap = median(gaps) || 12
  const typicalLength = median(lines.map((l) => l.text.length)) || 60

  const blocks = []
  let cur = null
  const flush = () => {
    if (cur) blocks.push({ text: cur.text, page: page.page, heading: false })
    cur = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prev = lines[i - 1]
    if (isHeading(line.text)) {
      flush()
      blocks.push({ text: line.text, page: page.page, heading: true })
      continue
    }
    const gap = prev ? prev.y - line.y : 0
    const newParagraph =
      !cur ||
      gap > typicalGap * 1.6 ||
      gap < 0 || // column change
      LIST_START.test(line.text) ||
      (TERMINAL.test(cur.text) && prev && prev.text.length < typicalLength * 0.6)
    if (newParagraph) {
      flush()
      cur = { text: line.text }
    } else {
      cur.text = joinLines(cur.text, line.text)
    }
  }
  flush()
  return blocks
}

function cleanPages(pages) {
  const repeated = repeatedEdgeKeys(pages)
  const blocks = []
  for (const page of pages) {
    for (const block of pageBlocks(page, repeated)) {
      const last = blocks[blocks.length - 1]
      // Paragraph continuing across a page break: keep it as one block.
      if (last && !last.heading && !block.heading && last.page === block.page - 1 &&
          !TERMINAL.test(last.text) && /^\p{Ll}/u.test(block.text)) {
        last.text = joinLines(last.text, block.text)
        last.pageEnd = block.page
      } else {
        blocks.push(block)
      }
    }
  }
  return blocks.map((b) => ({ text: b.text, page: b.page, pageEnd: b.pageEnd || b.page, heading: b.heading }))
}

module.exports = { cleanPages, isHeading, joinLines, repeatedEdgeKeys }
