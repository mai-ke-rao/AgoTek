// Page-by-page text extraction with pdfjs-dist, keeping line geometry so the
// cleaner can find paragraph breaks and repeated headers/footers.
// Returns [{ page, lines: [{ text, y, h }] }], page numbers 1-based (PDF
// page index — what "#page=N" links open).

function needsSpace(current, next, gap, height) {
  if (!current || /\s$/.test(current) || /^\s/.test(next)) return false
  return gap > height * 0.15
}

function groupLines(items) {
  const lines = []
  let cur = null
  const flush = () => {
    if (cur && cur.text.trim()) lines.push({ text: cur.text, y: cur.y, h: cur.h })
    cur = null
  }

  for (const item of items) {
    if (typeof item.str !== 'string') continue // marked-content markers
    const [, , , d, x, y] = item.transform
    const h = item.height || Math.abs(d) || 10
    if (cur && Math.abs(y - cur.y) > Math.max(2, h * 0.5)) flush()
    if (!cur) {
      cur = { text: '', y, h, xEnd: x }
    } else if (needsSpace(cur.text, item.str, x - cur.xEnd, h)) {
      cur.text += ' '
    }
    cur.text += item.str
    cur.xEnd = x + (item.width || 0)
    cur.h = Math.max(cur.h, h)
    if (item.hasEOL) flush()
  }
  flush()
  return lines
}

async function extractPages(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise

  const pages = []
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      pages.push({ page: n, lines: groupLines(content.items) })
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return pages
}

module.exports = { extractPages, groupLines }
