const { splitUnits, joinUnits, listMarker } = require('./markdownUnits')
const { tagsIn } = require('./validateCitations')
const { message } = require('./messages')

// Number check, run after citation validation on every answer (flagged or
// not). A paragraph that states a quantity — dose, concentration, rate,
// depth, interval — keeps it only if every number in it occurs in a source
// that paragraph cites. Otherwise the paragraph is replaced by a fixed
// notice. This also catches invented fertilizer and irrigation rates.
//
// Manual passages ([S]) need an exact match: never estimated, converted or
// rounded. Data results ([D]) may be rounded to the precision the answer
// shows (23.456 in the data may be stated as 23.5).

const NUM = String.raw`\d+(?:[.,]\d+)*`
const UNIT = [
  'ml', 'mL', 'l', 'L', 'g', 'kg', 'mg', 't', '%', '‰', 'ppm', 'mm', 'cm', 'm3', 'm³',
  'dana', 'dan', 'days', 'day',
  'мл', 'л', 'г', 'кг', 'мг', 'т', 'мм', 'цм', 'дана', 'дан',
].sort((a, b) => b.length - a.length).join('|') // longest first: "ml" before "l"; none need escaping

const QUANTITY = new RegExp(
  String.raw`(?<![\p{L}\d.,])(${NUM})(?:\s*(?:-|–|—|do|to|i|and)\s*(${NUM}))?\s*(?:${UNIT})(?![\p{L}\d])`,
  'gu'
)
// Near these words every number counts, unit or not ("karenca je 21").
const INTERVAL_CONTEXT = /karenc|каренц|\bphi\b|pre-?harvest|waiting period|period čekanja|period cekanja/i
const ANY_NUMBER = new RegExp(String.raw`(?<![\p{L}\d.,])${NUM}`, 'gu')

const SPACES_IN_NUMBER = /(\d)[    ](?=\d{3}(?!\d))/g

function prepare(text) {
  return String(text)
    .replace(/\[[SD]\d+\]/g, ' ') // tag digits are not quantities
    .replace(/^\s*(?:[-*•+]|\d{1,3}[.)])\s+/gm, ' ') // nor are list numbers
    .replace(/[   ]/g, ' ')
}

// All numeric readings of a token: "0,5" → 0.5, "1.000" → 1000 and 1,
// "1.000,5" → 1000.5.
function numberValues(raw) {
  const s = String(raw).replace(/[\s   ]/g, '')
  const values = new Set()
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) values.add(Number(s.replace(/[.,]/g, '')))
  if (/^\d+(?:[.,]\d+)?$/.test(s)) values.add(Number(s.replace(',', '.')))
  if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(s)) values.add(Number(s.replace(/\./g, '').replace(',', '.')))
  if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(s)) values.add(Number(s.replace(/,/g, '')))
  return [...values].filter(Number.isFinite)
}

function decimals(raw) {
  const s = String(raw).replace(/\s/g, '')
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return 0
  const m = s.match(/[.,](\d+)$/)
  return m ? m[1].length : 0
}

// Numbers stated as quantities in one answer unit.
function quantityNumbers(text) {
  const prepared = prepare(text).replace(SPACES_IN_NUMBER, '$1')
  const found = []
  for (const m of prepared.matchAll(QUANTITY)) {
    found.push(m[1])
    if (m[2]) found.push(m[2])
  }
  if (INTERVAL_CONTEXT.test(prepared)) {
    for (const m of prepared.matchAll(ANY_NUMBER)) found.push(m[0])
  }
  return [...new Set(found)]
}

// Every number in a source, read both with and without grouped spaces
// ("1 000" may be one number or two table cells).
function sourceNumbers(text) {
  const values = []
  const raw = String(text).replace(/[   ]/g, ' ')
  for (const variant of [raw, raw.replace(SPACES_IN_NUMBER, '$1')]) {
    for (const m of variant.matchAll(ANY_NUMBER)) values.push(...numberValues(m[0]))
  }
  return values
}

function roundTo(x, d) {
  const f = 10 ** d
  return Math.round(x * f) / f
}

function sourceHasNumber(source, raw) {
  const wanted = numberValues(raw)
  if (wanted.length === 0) return false
  if (!source.numbers) source.numbers = sourceNumbers(source.text)
  if (source.kind === 'data') {
    const d = decimals(raw)
    return source.numbers.some((x) => wanted.some((w) => Math.abs(roundTo(x, d) - w) < 1e-9))
  }
  return source.numbers.some((x) => wanted.some((w) => Math.abs(x - w) < 1e-9))
}

// sources: Map<tag, { kind: 'manual' | 'data', text }>
function guardDoses(answer, sources, lang) {
  if (!answer) return { answer, removedDoses: 0 }
  const units = splitUnits(answer)
  let removedDoses = 0

  for (const unit of units) {
    if (unit.type === 'heading') continue
    const numbers = quantityNumbers(unit.text)
    if (numbers.length === 0) continue

    const cited = tagsIn(unit.text).map((t) => sources.get(t)).filter(Boolean)
    const grounded = numbers.every((n) => cited.some((src) => sourceHasNumber(src, n)))
    if (!grounded) {
      unit.text = listMarker(unit.text) + message(lang, 'doseNotShown')
      removedDoses++
    }
  }

  return { answer: joinUnits(units), removedDoses }
}

module.exports = { guardDoses, quantityNumbers, numberValues, sourceNumbers }
