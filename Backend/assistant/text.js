// Script and diacritic normalization shared by the keyword flags (matching)
// and the embedder (retrieval). Three of the four manuals are Serbian
// Cyrillic while most users type Serbian Latin, often without diacritics.

const CYRILLIC_TO_LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i',
  ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
}

function cyrillicToLatin(text) {
  let out = ''
  for (const ch of String(text)) {
    const lower = ch.toLowerCase()
    const mapped = CYRILLIC_TO_LATIN[lower]
    if (mapped === undefined) {
      out += ch
    } else if (ch !== lower) {
      out += mapped.charAt(0).toUpperCase() + mapped.slice(1) // Љ → Lj
    } else {
      out += mapped
    }
  }
  return out
}

// For deterministic keyword matching: lowercase, Latin script, ASCII only
// (šljiva → sljiva, ђубриво → djubrivo).
function foldForMatch(text) {
  return cyrillicToLatin(text)
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

// For the embedder: same script on both sides of the similarity, diacritics
// kept (they carry meaning for the multilingual model).
function toEmbeddingText(text) {
  return cyrillicToLatin(text).replace(/\s+/g, ' ').trim()
}

// Keyword side of hybrid retrieval. Stored chunks are folded the same way as
// queries, so "ФЕРТИГАЦИЈЕ", "fertigacijom" and "fertigation" meet on ASCII.
const toSearchText = (text) => foldForMatch(text).replace(/\s+/g, ' ').trim()

const STOPWORDS = new Set([
  // sr (folded)
  'kako', 'koji', 'koja', 'koje', 'kojim', 'kojih', 'kada', 'kad', 'gde', 'zasto', 'treba', 'trebalo',
  'moze', 'mogu', 'biti', 'jeste', 'jesu', 'ovaj', 'ova', 'ovo', 'taj', 'tog', 'toga', 'ili', 'ali',
  'samo', 'vise', 'manje', 'kod', 'koliko', 'kakav', 'kakva', 'kakvo', 'sta', 'cemu', 'nego', 'izmedju',
  'tokom', 'posle', 'pre', 'prema', 'njihov', 'njegov', 'svoj', 'neki', 'neka', 'neko', 'nesto', 'imati',
  'ima', 'nema', 'bilo', 'sve', 'svi', 'sam', 'smo', 'ste', 'jer', 'zbog', 'kroz', 'iznad', 'ispod',
  'radi', 'objasni', 'reci', 'molim',
  // en
  'what', 'which', 'when', 'where', 'why', 'how', 'does', 'should', 'could', 'would', 'with', 'from',
  'that', 'this', 'these', 'those', 'about', 'into', 'there', 'their', 'have', 'been', 'done', 'much',
  'many', 'more', 'most', 'some', 'than', 'then', 'they', 'your', 'tell', 'explain', 'please', 'best',
])

// Query → prefix terms for to_tsquery ("fertigacija" → "fertig:*"): Serbian
// is heavily inflected and has no Postgres stemmer, and the shorter prefix
// also lets English loanwords hit ("fertigation" → "fertig:*"). Rare terms
// get the weight in SQL (IDF), so short prefixes of common words cost little.
// Output is [a-z0-9] only, safe to pass to to_tsquery.
function searchTerms(query, max = 8) {
  const words = toSearchText(query).split(/[^a-z0-9]+/)
  const terms = []
  for (const w of words) {
    if (w.length < 4 || /^\d+$/.test(w) || STOPWORDS.has(w)) continue
    const stem = w.length > 6 ? w.slice(0, Math.max(5, w.length - 5)) : w
    const term = `${stem}:*`
    if (!terms.includes(term)) terms.push(term)
  }
  return terms.slice(0, max)
}

module.exports = { cyrillicToLatin, foldForMatch, toEmbeddingText, toSearchText, searchTerms }
