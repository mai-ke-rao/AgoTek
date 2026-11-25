const { test } = require('node:test')
const assert = require('node:assert/strict')
const { cleanPages, joinLines, isHeading } = require('../../assistant/ingest/clean')
const { chunkBlocks } = require('../../assistant/ingest/chunk')
const { checkEmbeddingModels } = require('../../assistant/index')

const words = async (text) => text.split(/\s+/).filter(Boolean).length // fake tokenizer

function page(n, texts) {
  return { page: n, lines: texts.map((text, i) => ({ text, y: 800 - i * 12, h: 10 })) }
}

test('repeated headers/footers and page numbers are dropped', () => {
  const topics = ['azotu', 'fosforu', 'kalijumu', 'boru', 'cinku']
  const pages = [1, 2, 3, 4, 5].map((n) => page(n, [
    'Primena đubriva u višegodišnjim zasadima',
    `Ovaj pasus govori o ${topics[n - 1]}.`,
    `${n}`,
  ]))
  const blocks = cleanPages(pages)
  assert.ok(blocks.every((b) => !b.text.includes('višegodišnjim zasadima')))
  assert.ok(blocks.every((b) => !/^\d+$/.test(b.text)))
  assert.equal(blocks.length, 5)
})

test('table-of-contents lines and references sections are dropped, real sections kept', () => {
  const prose = 'Фертигација вишегодишњих засада углавном се врши наводњавањем кап по кап, ' +
    'које укључује убризгавање ђубрива у систем за наводњавање, тако да се хранљиве материје ' +
    'доводе директно у зону кореновог система, у мањим и чешћим дозама током вегетације.'
  const blocks = cleanPages([
    page(1, ['Kada i kako voćnjak treba navodnjavati? .................... 60', 'Šta je fertigacija? ..... 61']),
    page(2, [prose]),
    page(3, ['ЛИТЕРАТУРА', '1. Anderson, K.K., Grant, J. (2006). Guide to efficient nitrogen fertilizer use.',
      'Петровић, М., Јовић, Н. 2010. Ђубрење воћака. Нови Сад.']),
    page(4, ['7. ПРИМЕНА ЂУБРИВА ПУТЕМ ФЕРТИГАЦИЈЕ', prose]),
    page(5, ['3.4. Izvori finansiranja', 'Sredstva za podizanje zasada mogu se obezbediti kreditom.']),
  ])
  const texts = blocks.map((b) => b.text)
  assert.ok(!texts.some((t) => t.includes('....')), 'TOC lines dropped')
  assert.ok(!texts.some((t) => /Anderson|Петровић|ЛИТЕРАТУРА/.test(t)), 'references dropped')
  assert.ok(texts.includes('7. ПРИМЕНА ЂУБРИВА ПУТЕМ ФЕРТИГАЦИЈЕ'), 'next chapter kept')
  assert.equal(texts.filter((t) => t === prose).length, 2)
  assert.ok(texts.includes('3.4. Izvori finansiranja'), '"Izvori ..." heading is not a references heading')
  assert.ok(texts.some((t) => t.startsWith('Sredstva za podizanje')))
})

test('mid-entry reference blocks are dropped; species names are not citations', () => {
  const { isCitation } = require('../../assistant/ingest/clean')
  assert.ok(isCitation('nitrogen use. Манојловић, М., Белић, М., Нешић, Љ. (2014). Ђубрење. Нови Сад.'))
  assert.equal(isCitation('Сојеви Salmonella Typhimurium, S. Enteritidis, S. Bovismorbificans показали су осетљивост.'), false)
})

test('words hyphenated at line breaks are joined; real hyphens kept', () => {
  assert.equal(joinLines('primena đubri-', 'va u zasadu'), 'primena đubriva u zasadu')
  assert.equal(joinLines('odnos N-', 'P-K'), 'odnos N- P-K')
})

test('headings are recognized', () => {
  assert.ok(isHeading('4.1.1. Азот (N)'))
  assert.ok(isHeading('ПРИМЕНА ЂУБРИВА ПУТЕМ ФЕРТИГАЦИЈЕ'))
  assert.equal(isHeading('Ово је обична реченица у пасусу.'), false)
  assert.equal(isHeading('25 kg/ha азота'), false)
})

test('chunks respect the token target, overlap, and record page ranges', async () => {
  const sentence = (i) => `Rečenica broj ${i} govori o đubrenju voćnjaka azotom.`
  const blocks = []
  for (let p = 1; p <= 4; p++) {
    blocks.push({ text: Array.from({ length: 8 }, (_, i) => sentence(p * 10 + i)).join(' '), page: p, pageEnd: p, heading: false })
  }
  const chunks = await chunkBlocks(blocks, { countTokens: words, target: 120, overlap: 20 })
  assert.ok(chunks.length >= 3)
  for (const c of chunks) assert.ok((await words(c.content)) <= 120 + 20, `chunk too long: ${c.content.length}`)
  assert.equal(chunks[0].pageStart, 1)
  assert.ok(chunks.at(-1).pageEnd === 4)
  // overlap: the second chunk starts with text from the end of the first
  const lastSentenceOfFirst = chunks[0].content.split(/(?<=\.)\s+/).at(-1)
  assert.ok(chunks[1].content.includes(lastSentenceOfFirst))
})

test('a heading starts a new chunk and is kept with its section', async () => {
  const blocks = [
    { text: 'Prvi deo '.repeat(60).trim() + '.', page: 1, heading: false },
    { text: '6. ПРИМЕНА ЂУБРИВА ПУТЕМ ФЕРТИГАЦИЈЕ', page: 2, heading: true },
    { text: 'Fertigacija je primena đubriva kroz sistem za navodnjavanje.', page: 2, heading: false },
  ]
  const chunks = await chunkBlocks(blocks, { countTokens: words, target: 150, overlap: 20 })
  assert.equal(chunks.length, 2)
  assert.ok(chunks[1].content.startsWith('6. ПРИМЕНА'))
  assert.equal(chunks[1].pageStart, 2)
})

test('startup check fails fast on a mismatched embedding_model', () => {
  const bad = checkEmbeddingModels([{ embedding_model: 'Xenova/all-MiniLM-L6-v2', count: '10' }], 'Xenova/multilingual-e5-small')
  assert.equal(bad.ok, false)
  assert.match(bad.reason, /all-MiniLM-L6-v2/)
  const ok = checkEmbeddingModels([{ embedding_model: 'Xenova/multilingual-e5-small', count: '10' }], 'Xenova/multilingual-e5-small')
  assert.deepEqual(ok, { ok: true, chunkCount: 10 })
  assert.deepEqual(checkEmbeddingModels([], 'Xenova/multilingual-e5-small'), { ok: true, chunkCount: 0 })
})
