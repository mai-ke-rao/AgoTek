const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateCitations, parseTagList } = require('../../assistant/validateCitations')

const sent = ['S1', 'S2', 'S3', 'S4', 'S5']

test('a tag beyond the sources sent is removed and its paragraph dropped', () => {
  const r = validateCitations({
    status: 'answered',
    answer: 'Fertigacija štedi vodu [S1].\n\nOvo je izmišljeno [S9].',
  }, sent)
  assert.equal(r.answer, 'Fertigacija štedi vodu [S1].')
  assert.equal(r.removedParagraphs, 1)
  assert.equal(r.removedTags, 1)
  assert.equal(r.status, 'partial')
  assert.deepEqual(r.usedTags, ['S1'])
})

test('a paragraph keeps its valid tags when one of several is invalid', () => {
  const r = validateCitations({ status: 'answered', answer: 'Tekst [S2][S9].' }, sent)
  assert.equal(r.answer, 'Tekst [S2].')
  assert.equal(r.status, 'answered')
  assert.equal(r.removedParagraphs, 0)
})

test('no valid tags at all → insufficient', () => {
  const r = validateCitations({ status: 'answered', answer: 'Bez izvora.\n\n- stavka [S7]' }, sent)
  assert.equal(r.status, 'insufficient')
  assert.equal(r.answer, '')
})

test('model-declared insufficient stays insufficient with an empty answer', () => {
  const r = validateCitations({ status: 'insufficient', answer: 'nešto [S1]' }, sent)
  assert.equal(r.status, 'insufficient')
  assert.equal(r.answer, '')
})

test('list items are validated one by one; headings are exempt', () => {
  const r = validateCitations({
    status: 'answered',
    answer: '## Prednosti\n- ušteda vode [S1]\n- bez izvora\n- ravnomerno [S2]',
  }, sent)
  assert.equal(r.answer, '## Prednosti\n- ušteda vode [S1]\n- ravnomerno [S2]')
  assert.equal(r.removedParagraphs, 1)
  assert.equal(r.status, 'partial')
})

test('a heading left without content is dropped too', () => {
  const r = validateCitations({ status: 'partial', answer: 'Uvod [S1].\n\n## Doze\n\nizmišljeno' }, sent)
  assert.equal(r.answer, 'Uvod [S1].')
})

test('grouped and ranged tags are normalized; data tags count', () => {
  assert.deepEqual(parseTagList('S1, S3'), ['S1', 'S3'])
  assert.deepEqual(parseTagList('S1-S3'), ['S1', 'S2', 'S3'])
  assert.deepEqual(parseTagList('S2, 4'), ['S2', 'S4'])
  const r = validateCitations({ status: 'answered', answer: 'Vlaga je 23 % [D1, S2].' }, ['D1', 'S2'])
  assert.equal(r.answer, 'Vlaga je 23 % [D1][S2].')
  assert.deepEqual(r.usedTags, ['D1', 'S2'])
})

test('non-citation brackets are left alone', () => {
  const r = validateCitations({ status: 'answered', answer: 'Videti [napomena] u tekstu [S1].' }, sent)
  assert.equal(r.answer, 'Videti [napomena] u tekstu [S1].')
})
