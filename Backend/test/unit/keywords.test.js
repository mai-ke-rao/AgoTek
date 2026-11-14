const { test } = require('node:test')
const assert = require('node:assert/strict')
const { detectPesticideTopic } = require('../../assistant/pesticideKeywords')
const { hasDataIntent } = require('../../assistant/dataIntent')
const { foldForMatch, cyrillicToLatin } = require('../../assistant/text')

test('normalization: Cyrillic, diacritics, case', () => {
  assert.equal(foldForMatch('Шљива'), 'sljiva')
  assert.equal(foldForMatch('ĐUBRIVO'), 'djubrivo')
  assert.equal(cyrillicToLatin('Љубав и Ђубре'), 'Ljubav i Đubre')
})

test('pesticide questions are flagged in Serbian (both scripts) and English', () => {
  for (const q of [
    'koliko ml fungicida na 10 l za šljivu',
    'karenca za bakar',
    'Каренца за бакар',
    'Kolika je doza glifosata?',
    'sredstvo za zaštitu bilja protiv vaši',
    'What is the PHI for copper?',
    'how much to spray on grapes',
  ]) {
    assert.ok(detectPesticideTopic(q).flagged, q)
  }
})

test('ripening and fertilizer questions without pesticide words are not flagged', () => {
  for (const q of ['Kada dozreva šljiva?', 'Kako izgleda dozrevanje grožđa?', 'Šta je fertigacija?', 'graphic of phosphorus uptake']) {
    assert.equal(detectPesticideTopic(q).flagged, false, q)
  }
})

test('data intent', () => {
  assert.ok(hasDataIntent('Kolika je vlaga na mojoj parceli?'))
  assert.ok(hasDataIntent('Create a rule that opens the valve'))
  assert.ok(hasDataIntent('Napravi pravilo za ventil'))
  assert.equal(hasDataIntent('What is the capital of Australia?'), false)
  assert.equal(hasDataIntent('Šta je fertigacija?'), false)
})
