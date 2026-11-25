const { test } = require('node:test')
const assert = require('node:assert/strict')
const { searchTerms, toSearchText } = require('../../assistant/text')
const { fuse } = require('../../assistant/retrieval')

test('stored text and queries fold to the same ASCII form', () => {
  assert.equal(toSearchText('ПРИМЕНА ЂУБРИВА путем   фертигације'), 'primena djubriva putem fertigacije')
})

test('query terms: stopwords dropped, inflections and loanwords share a prefix', () => {
  assert.deepEqual(searchTerms('Kako se izvodi fertigacija u voćnjaku?'), ['izvodi:*', 'fertig:*', 'vocnj:*'])
  assert.deepEqual(searchTerms('How is fertigation done in an orchard?'), ['fertig:*', 'orcha:*'])
  assert.deepEqual(searchTerms('Како се изводи фертигација?'), ['izvodi:*', 'fertig:*'])
  assert.deepEqual(searchTerms("'); DROP TABLE chunks; --"), ['drop:*', 'table:*', 'chunks:*'])
  assert.deepEqual(searchTerms('?? 25 kg'), [])
})

test('rank fusion favors chunks both lists agree on', () => {
  const row = (id, similarity) => ({ id, similarity })
  const dense = [row('mozg-189', 0.87), row('mozg-60', 0.86), row('prim-111', 0.85)]
  const lexical = [row('prim-111', 0.85), row('prim-113', 0.84)]
  const fused = fuse([dense, lexical]).map((r) => r.id)
  assert.equal(fused[0], 'prim-111')
  assert.deepEqual(new Set(fused), new Set(['mozg-189', 'mozg-60', 'prim-111', 'prim-113']))
})
