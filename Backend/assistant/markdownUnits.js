// Splits a markdown answer into the units the guards work on: headings,
// list items and paragraphs. Each unit remembers whether a blank line
// preceded it so the answer can be rebuilt with the same layout after units
// are dropped or replaced.

const HEADING = /^\s{0,3}#{1,6}\s+\S/
const LIST_ITEM = /^\s*(?:[-*•+]|\d{1,3}[.)])\s+/
const CONTINUATION = /^\s{2,}\S/

function splitUnits(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n')
  const units = []
  let current = null
  let gap = '\n'

  const close = () => {
    if (current) {
      units.push({ type: current.type, text: current.lines.join('\n'), gapBefore: current.gapBefore })
      current = null
    }
  }

  for (const line of lines) {
    if (line.trim() === '') {
      close()
      gap = '\n\n'
      continue
    }
    if (HEADING.test(line)) {
      close()
      units.push({ type: 'heading', text: line, gapBefore: gap })
    } else if (LIST_ITEM.test(line)) {
      close()
      current = { type: 'item', lines: [line], gapBefore: gap }
    } else if (current && current.type === 'item' && CONTINUATION.test(line)) {
      current.lines.push(line)
    } else if (current && current.type === 'paragraph') {
      current.lines.push(line)
    } else {
      close()
      current = { type: 'paragraph', lines: [line], gapBefore: gap }
    }
    gap = '\n'
  }
  close()
  return units
}

// Rebuild from units, skipping ones marked `dropped`. A dropped unit's
// blank-line gap is carried to the next kept unit so paragraphs don't get
// glued together.
function joinUnits(units) {
  let out = ''
  let pendingGap = ''
  let first = true
  for (const unit of units) {
    if (unit.dropped) {
      if (unit.gapBefore === '\n\n') pendingGap = '\n\n'
      continue
    }
    const gap = pendingGap === '\n\n' || unit.gapBefore === '\n\n' ? '\n\n' : '\n'
    out += first ? unit.text : gap + unit.text
    first = false
    pendingGap = ''
  }
  return out
}

// "- text" / "1. text" → the marker, so a replaced list item stays a list item.
function listMarker(text) {
  const m = String(text).match(LIST_ITEM)
  return m ? m[0] : ''
}

module.exports = { splitUnits, joinUnits, listMarker }
