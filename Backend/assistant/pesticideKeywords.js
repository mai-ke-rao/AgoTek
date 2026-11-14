const { foldForMatch } = require('./text')

// Deterministic pesticide/dose flag, run on the question before Gemini.
// A false positive only adds the stricter prompt rule and the disclaimer, so
// the list leans toward matching. Patterns run on foldForMatch() output:
// lowercase ASCII Latin, so Cyrillic and diacritic-less input match too.

const STEMS = [
  // Serbian
  /\bpesticid/, /\bfungicid/, /\binsekticid/, /\bherbicid/, /\bakaricid/,
  /\bnematocid/, /\brodenticid/, /\bprska/, /\bzaprasi/, /\bpreparat/,
  /\bkarenc/, /\bkoncentracij/,
  // The spec's bare `doz` stem also matches dozrevanje/dozreo (ripening) and
  // dozvola (permit), which are everywhere in harvest questions. Only the
  // dose forms are matched.
  /\bdoz(a|e|i|u|om|ama|iranj\w*|irati|iraj\w*)\b/,
  /\bzastit\w* bilja\b/,
  // English
  /\bpesticide/, /\bfungicide/, /\binsecticide/, /\bherbicide/, /\bacaricide/,
  /\bspray/, /\bdos(e|es|ed|age|ing)\b/, /\bpre-?harvest interval/,
  /\bphi\b/, // whole word only: a stem would match "phosphorus", "graphic"
  /\bwaiting period/, /\bplant protection product/,
]

// Both must appear: "sredstvo za zaštitu bilja".
const COMBINATIONS = [[/\bsredstv/, /\bzastit/]]

// Starter list of active substances; extend it from rag_query_log.
const ACTIVE_SUBSTANCES = [
  'bakar', 'bakr', 'copper', 'sumpor', 'sulfur', 'sulphur', 'glifosat', 'glyphosate',
  'mankozeb', 'mancozeb', 'kaptan', 'captan', 'tebukonazol', 'tebuconazole',
  'difenokonazol', 'difenoconazole', 'azoksistrobin', 'azoxystrobin',
  'deltametrin', 'deltamethrin', 'cipermetrin', 'cypermethrin',
  'lambda-cihalotrin', 'lambda-cyhalothrin', 'imidakloprid', 'imidacloprid',
  'abamektin', 'abamectin', 'spinosad', 'piretrin', 'pyrethrin',
  'metribuzin', 'bordo', 'bordeaux',
]
const SUBSTANCE_PATTERN = new RegExp(
  `\\b(${ACTIVE_SUBSTANCES.map((s) => s.replace(/[-]/g, '\\-')).join('|')})`
)

function detectPesticideTopic(question) {
  const text = foldForMatch(question || '')
  const matched = []

  for (const re of STEMS) {
    const m = text.match(re)
    if (m) matched.push(m[0])
  }
  for (const [a, b] of COMBINATIONS) {
    const ma = text.match(a)
    const mb = text.match(b)
    if (ma && mb) matched.push(`${ma[0]}+${mb[0]}`)
  }
  const sub = text.match(SUBSTANCE_PATTERN)
  if (sub) matched.push(sub[0])

  return { flagged: matched.length > 0, matched }
}

module.exports = { detectPesticideTopic, ACTIVE_SUBSTANCES }
