const { foldForMatch } = require('./text')

// Deterministic "is this about the user's own AgroTek data?" check. It only
// decides whether a question that failed the similarity gate may still go to
// the agent (to call data/rule tools) or short-circuits without any Gemini
// call. Leaning toward matching is safe: a false positive costs one Gemini
// call, and the citation check still blocks an ungrounded answer.

const PATTERNS = [
  // possessives and the app's own nouns (sr)
  /\bmoj(a|e|i|u|ih|im|om|oj)?\b/, /\bnas(a|e|i|u|ih|im|em)?\b/,
  /\bparcel/, /\bnjiv/, /\buredjaj/, /\bsenzor/, /\btelemetr/, /\bocitav/, /\bmerenj/,
  /\bpravil/, /\bautomatiz/, /\baktivnost/, /\bknjig\w* polja\b/, /\bdownlink/, /\buplink/,
  /\bventil/, /\bpumpa/, /\bkada je poslednj/, /\bjuce\b/, /\bdanas\b/, /\bsinoc/,
  // en
  /\bmy\b/, /\bour\b/, /\bfield/, /\bparcel/, /\bdevice/, /\bsensor/, /\breading/,
  /\brule/, /\bautomat/, /\bactivit/, /\byesterday\b/, /\btoday\b/, /\blast (night|week|day)/,
  /\bvalve/, /\bpump/, /\bttn\b/, /\blora/,
]

function hasDataIntent(question) {
  const text = foldForMatch(question || '')
  return PATTERNS.some((re) => re.test(text))
}

module.exports = { hasDataIntent }
