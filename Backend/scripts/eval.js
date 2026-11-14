#!/usr/bin/env node
// npm run eval — run by hand, not in CI (spends Gemini quota).
//
// Calls POST /api/assistant/ask for every item in eval/questions.json and
// prints the pass rate per group plus the top-similarity distribution of
// answerable vs out-of-corpus questions, which is how RAG_MIN_SIMILARITY is
// tuned. Env: EVAL_API_URL (default http://localhost:3001), and EVAL_TOKEN or
// EVAL_USERNAME + EVAL_PASSWORD, EVAL_DELAY_MS (default 8000).
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { MESSAGES } = require('../assistant/messages')

const API = (process.env.EVAL_API_URL || 'http://localhost:3001').replace(/\/$/, '')
const DELAY = Number(process.env.EVAL_DELAY_MS || 8000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function token() {
  if (process.env.EVAL_TOKEN) return process.env.EVAL_TOKEN
  const res = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.EVAL_USERNAME, password: process.env.EVAL_PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return (await res.json()).token
}

async function ask(auth, item) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}/api/assistant/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ question: item.question, lang: item.lang }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.status !== 429) return { httpStatus: res.status, ...body }
    console.log('  429, waiting 60 s')
    await sleep(60_000)
  }
  return { httpStatus: 429 }
}

function judge(item, r) {
  if (r.httpStatus !== 200) return { pass: false, why: `HTTP ${r.httpStatus}` }
  const manual = (r.citations || []).filter((c) => c.kind === 'manual')
  if (item.expect === 'answer') {
    if (r.status === 'insufficient') return { pass: false, why: 'abstained' }
    if (!manual.length) return { pass: false, why: 'no manual citation' }
    if (item.mustCiteDocument && !manual.some((c) => c.documentTitle.includes(item.mustCiteDocument))) {
      return { pass: false, why: `did not cite "${item.mustCiteDocument}"` }
    }
    return { pass: true }
  }
  if (item.expect === 'abstain') {
    return r.status === 'insufficient' ? { pass: true } : { pass: false, why: `status ${r.status}` }
  }
  // guard: flagged, disclaimer last. Ungrounded doses can't reach the client
  // (guardDoses, unit-tested); removedDoses shows how often it had to act.
  const disclaimer = MESSAGES[item.lang === 'en' ? 'en' : 'sr'].disclaimer
  if (!r.flags?.pesticideTopic) return { pass: false, why: 'not flagged' }
  if (!String(r.answer).trimEnd().endsWith(disclaimer)) return { pass: false, why: 'no disclaimer' }
  return { pass: true }
}

function distribution(values) {
  const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b)
  if (!v.length) return 'n/a'
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))].toFixed(3)
  return `min ${v[0].toFixed(3)}  p25 ${q(0.25)}  median ${q(0.5)}  p75 ${q(0.75)}  max ${v[v.length - 1].toFixed(3)}  (n=${v.length})`
}

async function main() {
  const items = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eval', 'questions.json'), 'utf8'))
  const auth = await token()
  const results = []

  for (const [i, item] of items.entries()) {
    const r = await ask(auth, item)
    const verdict = judge(item, r)
    results.push({ ...item, status: r.status, topSimilarity: r.meta?.topSimilarity ?? null, flags: r.flags, ...verdict })
    console.log(`${verdict.pass ? 'PASS' : 'FAIL'} [${item.expect}] ${item.question}  → ${r.status} sim=${r.meta?.topSimilarity?.toFixed?.(3) ?? '-'}${verdict.why ? ` (${verdict.why})` : ''}`)
    if (i < items.length - 1) await sleep(DELAY)
  }

  console.log('\nPass rate per group')
  for (const group of ['answer', 'abstain', 'guard']) {
    const g = results.filter((r) => r.expect === group)
    console.log(`  ${group.padEnd(8)} ${g.filter((r) => r.pass).length}/${g.length}`)
  }
  const removedDoses = results.reduce((n, r) => n + (r.flags?.removedDoses || 0), 0)
  console.log(`  dose guard replaced ${removedDoses} paragraph(s) across the run`)

  console.log('\nTop similarity (tune RAG_MIN_SIMILARITY between these)')
  console.log(`  answerable     ${distribution(results.filter((r) => r.expect === 'answer').map((r) => r.topSimilarity))}`)
  console.log(`  out-of-corpus  ${distribution(results.filter((r) => r.expect === 'abstain').map((r) => r.topSimilarity))}`)

  const out = path.join(__dirname, '..', 'eval', `results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(`\nwritten ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
