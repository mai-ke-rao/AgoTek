const { splitUnits, joinUnits } = require('./markdownUnits')

// Server-side citation validation. Pure function; see test/unit.
//
// Tags: [S1].. are manual passages, [D1].. are results of the user's own data
// tools (telemetry, activities, rules, rule proposals). Both count as sources.
//
// 1. A tag is valid only if it names a source actually sent to the model;
//    invalid tags are removed. Grouped forms ([S1, S3], [S1-S3]) are
//    normalized to [S1][S3] first.
// 2. Any paragraph or list item left without a valid tag is dropped.
//    Headings are exempt (but dropped if nothing remains under them).
// 3. If anything was dropped, status is at most "partial"; if nothing tagged
//    remains, status is "insufficient".
// 4. usedTags lists the tags still in the answer, for building citations.

const STATUS_RANK = { insufficient: 0, partial: 1, answered: 2 }

const BRACKET = /\[([^[\]\n]{1,60})\]/g
const TAG_LIST = /^\s*[SD]\s*\d+(?:\s*(?:[,;]|[-–])\s*[SD]?\s*\d+)*\s*$/i

function parseTagList(inner) {
  const tags = []
  let letter = null
  let rangeFrom = null
  for (const token of inner.match(/[SD]?\s*\d+|[-–]/gi) || []) {
    if (token === '-' || token === '–') {
      rangeFrom = tags.length ? tags[tags.length - 1] : null
      continue
    }
    const m = token.match(/^([SD])?\s*(\d+)$/i)
    if (m[1]) letter = m[1].toUpperCase()
    const n = Number(m[2])
    if (rangeFrom && rangeFrom.letter === letter && n > rangeFrom.n && n - rangeFrom.n <= 10) {
      for (let i = rangeFrom.n + 1; i <= n; i++) tags.push({ letter, n: i })
    } else {
      tags.push({ letter, n })
    }
    rangeFrom = null
  }
  return tags.map((t) => `${t.letter}${t.n}`)
}

// Rewrites every tag bracket in `text`, keeping only valid tags.
function rewriteTags(text, valid) {
  const used = new Set()
  let removed = 0
  const out = text.replace(BRACKET, (whole, inner) => {
    if (!TAG_LIST.test(inner)) return whole // not a citation, e.g. "[note]"
    const kept = []
    for (const tag of parseTagList(inner)) {
      if (valid.has(tag)) {
        if (!kept.includes(tag)) kept.push(tag)
        used.add(tag)
      } else {
        removed++
      }
    }
    return kept.map((t) => `[${t}]`).join('')
  })
  return { text: tidy(out), used, removed }
}

// Removing a tag can leave "word ." or double spaces behind.
function tidy(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/(\S)[ \t]+([.,;:!?])/g, '$1$2').replace(/(\S)[ \t]{2,}/g, '$1 ').replace(/[ \t]+$/, ''))
    .join('\n')
}

function sortTags(tags) {
  return [...tags].sort((a, b) => a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1)))
}

function validateCitations({ status, answer }, sentTags) {
  const valid = new Set(sentTags)
  const empty = { status: 'insufficient', answer: '', removedParagraphs: 0, removedTags: 0, usedTags: [] }

  if (status === 'insufficient' || !answer || !answer.trim()) return empty

  const units = splitUnits(answer)
  const used = new Set()
  let removedParagraphs = 0
  let removedTags = 0

  for (const unit of units) {
    const r = rewriteTags(unit.text, valid)
    removedTags += r.removed
    unit.text = r.text
    if (unit.type === 'heading') continue
    if (r.used.size === 0) {
      unit.dropped = true
      removedParagraphs++
    } else {
      r.used.forEach((t) => used.add(t))
    }
  }

  // A heading with no surviving content before the next heading is noise.
  for (let i = 0; i < units.length; i++) {
    if (units[i].type !== 'heading') continue
    let hasContent = false
    for (let j = i + 1; j < units.length && units[j].type !== 'heading'; j++) {
      if (!units[j].dropped) { hasContent = true; break }
    }
    if (!hasContent) units[i].dropped = true
  }

  if (used.size === 0) return { ...empty, removedParagraphs, removedTags }

  let finalStatus = STATUS_RANK[status] === undefined ? 'partial' : status
  if (removedParagraphs > 0 && STATUS_RANK[finalStatus] > STATUS_RANK.partial) finalStatus = 'partial'

  return {
    status: finalStatus,
    answer: joinUnits(units),
    removedParagraphs,
    removedTags,
    usedTags: sortTags(used),
  }
}

const TAG_IN_TEXT = /\[([SD]\d+)\]/g

// Tags in an already-validated unit (canonical [S1][D2] form).
function tagsIn(text) {
  return [...String(text).matchAll(TAG_IN_TEXT)].map((m) => m[1])
}

module.exports = { validateCitations, parseTagList, tagsIn, sortTags }
