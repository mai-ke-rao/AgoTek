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

module.exports = { cyrillicToLatin, foldForMatch, toEmbeddingText }
