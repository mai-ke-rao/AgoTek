const { z } = require('zod')
const config = require('./config')
const db = require('./db')
const dataAccess = require('./dataAccess')

// Rules the assistant proposes. The model never creates a rule:
//   propose_rule → validate (Zod, same grammar as IOT's createRuleRequestSchema)
//               → ownership check on every dev_id → store as pending
//   user presses Confirm → re-validate + re-check ownership → IOT POST /api/rules
//               with the user's own JWT, always enabled:false
// IOT validates and checks ownership a third time, transactionally.

const COMPARATORS = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq']
const COMPARATOR_SYMBOL = { lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=', neq: '≠' }
const MAX_PAYLOAD_BYTES = 51 // LoRaWAN worst case (SF12)

const finiteNumber = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
  z.number().refine(Number.isFinite, 'must be a finite number')
)

const proposeRuleArgsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  combinator: z.enum(['AND', 'OR']).default('AND'),
  clauses: z.array(z.object({
    devId: z.string().trim().min(1).max(100),
    variable: z.string().trim().min(1).max(100),
    comparator: z.enum(COMPARATORS),
    threshold: finiteNumber,
  })).min(1, 'at least one condition').max(5, 'at most five conditions'),
  action: z.object({
    targetDevId: z.string().trim().min(1).max(100),
    payloadText: z.string().min(1).refine(
      (s) => Buffer.byteLength(s, 'utf8') <= MAX_PAYLOAD_BYTES,
      `payload must be at most ${MAX_PAYLOAD_BYTES} bytes`
    ),
    fPort: z.preprocess((v) => (v === undefined || v === null ? 1 : v), z.number().int().min(1).max(223)),
  }),
})

// Shape stored in the proposal and sent to IOT (matches createRuleRequestSchema).
const iotRuleSchema = z.object({
  name: z.string().min(1).max(100),
  combinator: z.enum(['AND', 'OR']),
  enabled: z.literal(false),
  clauses: z.array(z.object({
    devId: z.string().min(1),
    variable: z.string().min(1),
    comparator: z.enum(COMPARATORS),
    threshold: z.number().refine(Number.isFinite),
  })).min(1).max(5),
  action: z.object({
    type: z.literal('downlink'),
    targetDevId: z.string().min(1),
    payload: z.object({
      frm_payload: z.string().min(1),
      f_port: z.number().int().min(1).max(223),
      priority: z.literal('NORMAL'),
    }),
  }),
})

function toIotRule(args) {
  return {
    name: args.name,
    combinator: args.combinator,
    enabled: false, // never armed by the assistant
    clauses: args.clauses,
    action: {
      type: 'downlink',
      targetDevId: args.action.targetDevId,
      payload: {
        frm_payload: Buffer.from(args.action.payloadText, 'utf8').toString('base64'),
        f_port: args.action.fPort,
        priority: 'NORMAL',
      },
    },
  }
}

function summarize(args, lang) {
  const joiner = args.combinator === 'AND' ? (lang === 'en' ? ' AND ' : ' I ') : (lang === 'en' ? ' OR ' : ' ILI ')
  const cond = args.clauses
    .map((c) => `${c.variable} (${c.devId}) ${COMPARATOR_SYMBOL[c.comparator]} ${c.threshold}`)
    .join(joiner)
  return lang === 'en'
    ? `If ${cond} → send downlink "${args.action.payloadText}" (port ${args.action.fPort}) to ${args.action.targetDevId}`
    : `Ako ${cond} → pošalji downlink "${args.action.payloadText}" (port ${args.action.fPort}) na ${args.action.targetDevId}`
}

function issues(error) {
  return error.issues.map((i) => `${i.path.join('.') || 'rule'}: ${i.message}`)
}

async function assertOwned(userId, rule, access) {
  const devIds = [...rule.clauses.map((c) => c.devId), rule.action.targetDevId]
  const owned = await access.ownedDeviceIds(userId, devIds)
  return [...new Set(devIds)].filter((id) => !owned.has(id))
}

// Called by the propose_rule tool. Returns a result the model can cite.
async function proposeRule(userId, rawArgs, { lang = 'sr', access = dataAccess, store = storeProposal } = {}) {
  const parsed = proposeRuleArgsSchema.safeParse(rawArgs)
  if (!parsed.success) return { ok: false, error: 'invalid rule', details: issues(parsed.error) }

  const args = parsed.data
  const rule = toIotRule(args)

  // Not-owned and nonexistent devices get the same answer, so the tool can't
  // be used to probe other users' dev_ids.
  const missing = await assertOwned(userId, rule, access)
  if (missing.length) {
    return { ok: false, error: 'device(s) not found among your TTN devices', devIds: missing }
  }

  const warnings = []
  for (const c of args.clauses) {
    if (!(await access.variableSeen(c.devId, c.variable))) {
      warnings.push(lang === 'en'
        ? `${c.devId} has never reported "${c.variable}"; this condition stays false until it does.`
        : `${c.devId} nikad nije poslao "${c.variable}"; ovaj uslov je netačan dok ne stigne ta vrednost.`)
    }
  }

  const summary = summarize(args, lang)
  const proposal = await store({ userId, rule, summary, warnings })
  return {
    ok: true,
    proposal: { id: proposal.id, summary, warnings, expiresAt: proposal.expires_at, rule },
  }
}

async function storeProposal({ userId, rule, summary, warnings }) {
  const { rows } = await db.query(
    `INSERT INTO assistant_rule_proposals (user_id, rule, summary, warnings, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))
     RETURNING id, expires_at`,
    [String(userId), JSON.stringify(rule), summary, JSON.stringify(warnings), config.PROPOSAL_TTL_MINUTES]
  )
  return rows[0]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class ProposalError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function explainUnclaimable(userId, id) {
  const { rows } = await db.query(
    'SELECT status, expires_at < now() AS expired FROM assistant_rule_proposals WHERE id = $1 AND user_id = $2',
    [id, String(userId)]
  )
  if (!rows[0]) return new ProposalError(404, 'proposal not found')
  if (rows[0].status === 'pending' && rows[0].expired) return new ProposalError(410, 'proposal expired')
  return new ProposalError(409, `proposal already ${rows[0].status}`)
}

async function confirmProposal(userId, id, authorization, { access = dataAccess, fetchImpl = fetch } = {}) {
  if (!UUID.test(id)) throw new ProposalError(404, 'proposal not found')

  // Claim atomically: a double click can't create two rules.
  const { rows } = await db.query(
    `UPDATE assistant_rule_proposals SET status = 'confirming'
      WHERE id = $1 AND user_id = $2 AND status = 'pending' AND expires_at > now()
      RETURNING rule`,
    [id, String(userId)]
  )
  if (!rows[0]) throw await explainUnclaimable(userId, id)

  const finish = (status, fields = {}) => db.query(
    `UPDATE assistant_rule_proposals SET status = $2, rule_id = $3, error = $4,
            decided_at = CASE WHEN $2 = 'pending' THEN NULL ELSE now() END
      WHERE id = $1`,
    [id, status, fields.ruleId ?? null, fields.error ?? null]
  )

  const parsed = iotRuleSchema.safeParse(rows[0].rule)
  if (!parsed.success) {
    await finish('failed', { error: 'stored rule failed validation' })
    throw new ProposalError(422, 'stored rule failed validation')
  }

  // Devices may have been deleted or reassigned since the proposal.
  const missing = await assertOwned(userId, parsed.data, access)
  if (missing.length) {
    await finish('failed', { error: `devices not owned: ${missing.join(', ')}` })
    throw new ProposalError(403, 'device(s) not found among your TTN devices')
  }

  let response
  try {
    response = await fetchImpl(`${config.IOT_URL}/api/rules`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    await finish('pending') // network problem: let the user retry
    throw new ProposalError(502, 'automation service unreachable, try again')
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = typeof body.error === 'string' ? body.error : `automation service responded ${response.status}`
    await finish('failed', { error })
    throw new ProposalError(response.status >= 500 ? 502 : response.status, error)
  }

  await finish('confirmed', { ruleId: body.rule?.id })
  return { status: 'confirmed', ruleId: body.rule?.id ?? null, enabled: false }
}

async function rejectProposal(userId, id) {
  if (!UUID.test(id)) throw new ProposalError(404, 'proposal not found')
  const { rows } = await db.query(
    `UPDATE assistant_rule_proposals SET status = 'rejected', decided_at = now()
      WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
    [id, String(userId)]
  )
  if (!rows[0]) throw await explainUnclaimable(userId, id)
  return { status: 'rejected' }
}

module.exports = {
  proposeRule, confirmProposal, rejectProposal, ProposalError,
  proposeRuleArgsSchema, iotRuleSchema, toIotRule,
}
