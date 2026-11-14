const { test } = require('node:test')
const assert = require('node:assert/strict')
const { guardDoses, quantityNumbers, numberValues } = require('../../assistant/doseGuard')
const { MESSAGES } = require('../../assistant/messages')

const manual = (text) => ({ kind: 'manual', text })
const data = (text) => ({ kind: 'data', text })

test('a dose whose number is in the cited chunk passes through', () => {
  const sources = new Map([['S1', manual('Primeniti 0,5 l/ha u proleće, pre cvetanja.')]])
  const r = guardDoses('Primenite 0.5 l/ha pre cvetanja [S1].', sources, 'sr')
  assert.equal(r.removedDoses, 0)
  assert.equal(r.answer, 'Primenite 0.5 l/ha pre cvetanja [S1].')
})

test('a dose whose number is not in the cited chunk is replaced by the fixed notice', () => {
  const sources = new Map([['S1', manual('Primeniti 0,5 l/ha u proleće.')]])
  const r = guardDoses('Uvod bez brojeva [S1].\n\nPrimenite 2 l/ha [S1].', sources, 'sr')
  assert.equal(r.removedDoses, 1)
  assert.equal(r.answer, `Uvod bez brojeva [S1].\n\n${MESSAGES.sr.doseNotShown}`)
})

test('the number must be in a chunk that paragraph cites, not just any chunk', () => {
  const sources = new Map([['S1', manual('Nema brojeva ovde.')], ['S2', manual('Doza 3 kg/ha.')]])
  const r = guardDoses('Doza je 3 kg/ha [S1].', sources, 'en')
  assert.equal(r.removedDoses, 1)
  assert.equal(r.answer, MESSAGES.en.doseNotShown)
})

test('both ends of a range are checked', () => {
  const sources = new Map([['S1', manual('Dubina 25 cm.')]])
  assert.equal(guardDoses('Orati na 25-30 cm [S1].', sources, 'sr').removedDoses, 1)
  const ok = new Map([['S1', manual('Dubina 25–30 cm.')]])
  assert.equal(guardDoses('Orati na 25-30 cm [S1].', ok, 'sr').removedDoses, 0)
})

test('waiting-period numbers count even without a unit', () => {
  const sources = new Map([['S1', manual('Karenca iznosi 14 dana.')]])
  assert.equal(guardDoses('Karenca je 21 [S1].', sources, 'sr').removedDoses, 1)
  assert.equal(guardDoses('Karenca je 14 dana [S1].', sources, 'sr').removedDoses, 0)
})

test('list items keep their marker when replaced', () => {
  const sources = new Map([['S1', manual('ništa')]])
  const r = guardDoses('- prvo [S1]\n- 10 ml na 10 l vode [S1]', sources, 'sr')
  assert.equal(r.answer, `- prvo [S1]\n- ${MESSAGES.sr.doseNotShown}`)
})

test('data sources allow rounding to the precision shown; manuals do not', () => {
  const sources = new Map([['D1', data('{"avg":23.456}')], ['S1', manual('23,456 %')]])
  assert.equal(guardDoses('Prosečna vlaga 23.5 % [D1].', sources, 'sr').removedDoses, 0)
  assert.equal(guardDoses('Prosečna vlaga 23.5 % [S1].', sources, 'sr').removedDoses, 1)
})

test('tag digits and list numbers are not quantities', () => {
  assert.deepEqual(quantityNumbers('1. Tekst bez količina [S12]'), [])
  assert.deepEqual(quantityNumbers('Dodati 1 000 l vode'), ['1000'])
})

test('number normalization', () => {
  assert.deepEqual(numberValues('0,5'), [0.5])
  assert.ok(numberValues('1.000').includes(1000))
  assert.ok(numberValues('1.000,5').includes(1000.5))
})
