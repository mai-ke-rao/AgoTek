const { z } = require('zod')

// Agent tools. The model chooses tool names and arguments; it never chooses
// whose data is read. Every handler gets ctx.userId from the verified JWT and
// passes it to dataAccess, which scopes every query by it. Arguments are
// validated with Zod before they reach Mongo or Postgres.
//
// Data results are registered as [Dn] sources so answers about the user's own
// data are cited like manual passages.

const ACTIVITY_TYPES = ['obrada', 'djubrenje', 'setva/sadnja', 'nega useva', 'zetva/berba', 'komentar']
const DATE = /^\d{4}-\d{2}-\d{2}$/

const L = (ctx, sr, en) => (ctx.lang === 'en' ? en : sr)
const round = (x) => Math.round(x * 100) / 100

const declarations = [
  {
    name: 'search_manuals',
    description: 'Semantic search over the farming manuals (Serbian, mostly Cyrillic: fertilization, orchards, fertigation, organic farming, tillage, crop rotation, general agriculture Q&A). Returns passages tagged [Sn] that pass the relevance threshold, or sufficient:false when the manuals do not cover the query.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Short, specific search query, preferably in Serbian (the manuals are Serbian; Latin script is fine).' } },
      required: ['query'],
    },
  },
  {
    name: 'list_parcels',
    description: "The user's parcels (fields): id, name, crop, area.",
  },
  {
    name: 'get_activities',
    description: "The user's field activity log (Knjiga polja), newest first. Filter by parcel id (from list_parcels), activity type and date range.",
    parameters: {
      type: 'OBJECT',
      properties: {
        parcelId: { type: 'STRING' },
        activityType: { type: 'STRING', enum: ACTIVITY_TYPES },
        from: { type: 'STRING', description: 'YYYY-MM-DD' },
        to: { type: 'STRING', description: 'YYYY-MM-DD' },
        limit: { type: 'INTEGER', description: '1-50, default 20' },
      },
    },
  },
  {
    name: 'list_devices',
    description: "The user's IoT devices with dev_id, the variable names each has reported and when it last reported. Only TTN devices can be used in automation rules.",
  },
  {
    name: 'get_telemetry',
    description: 'Sensor readings for one of the user\'s devices over the last N hours: per variable the latest value, min, max, average, count and recent samples.',
    parameters: {
      type: 'OBJECT',
      properties: {
        devId: { type: 'STRING' },
        variables: { type: 'ARRAY', items: { type: 'STRING' } },
        hours: { type: 'INTEGER', description: '1-720, default 24' },
      },
      required: ['devId'],
    },
  },
  {
    name: 'list_rules',
    description: "The user's automation rules: conditions, action, enabled flag, last time each fired.",
  },
  {
    name: 'get_rule_history',
    description: 'When one of the user\'s rules fired and whether the downlink succeeded.',
    parameters: {
      type: 'OBJECT',
      properties: { ruleId: { type: 'INTEGER' }, limit: { type: 'INTEGER', description: '1-50, default 10' } },
      required: ['ruleId'],
    },
  },
  {
    name: 'propose_rule',
    description: 'Prepare an automation rule for the user to confirm. Does NOT create it. Use exact dev_ids and variable names from list_devices.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        combinator: { type: 'STRING', enum: ['AND', 'OR'] },
        clauses: {
          type: 'ARRAY',
          description: '1 to 5 conditions',
          items: {
            type: 'OBJECT',
            properties: {
              devId: { type: 'STRING' },
              variable: { type: 'STRING' },
              comparator: { type: 'STRING', enum: ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'] },
              threshold: { type: 'NUMBER' },
            },
            required: ['devId', 'variable', 'comparator', 'threshold'],
          },
        },
        action: {
          type: 'OBJECT',
          properties: {
            targetDevId: { type: 'STRING' },
            payloadText: { type: 'STRING', description: 'Text payload sent to the device, e.g. "OPEN".' },
            fPort: { type: 'INTEGER', description: 'LoRaWAN port, default 1' },
          },
          required: ['targetDevId', 'payloadText'],
        },
      },
      required: ['name', 'combinator', 'clauses', 'action'],
    },
  },
  {
    name: 'final_answer',
    description: 'Return the final answer to the user. Call exactly once, last.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['answered', 'partial', 'insufficient'] },
        answer: { type: 'STRING', description: 'Markdown with [Sn]/[Dn] tags; empty when insufficient.' },
        missing: { type: 'ARRAY', items: { type: 'STRING' }, description: 'What the sources did not cover.' },
      },
      required: ['status', 'answer'],
    },
  },
]

const schemas = {
  search_manuals: z.object({ query: z.string().trim().min(2).max(300) }),
  list_parcels: z.object({}).passthrough(),
  get_activities: z.object({
    parcelId: z.string().trim().max(64).optional(),
    activityType: z.enum(ACTIVITY_TYPES).optional(),
    from: z.string().regex(DATE).optional(),
    to: z.string().regex(DATE).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  list_devices: z.object({}).passthrough(),
  get_telemetry: z.object({
    devId: z.string().trim().min(1).max(100),
    variables: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    hours: z.number().int().min(1).max(720).default(24),
  }),
  list_rules: z.object({}).passthrough(),
  get_rule_history: z.object({
    ruleId: z.number().int().positive(),
    limit: z.number().int().min(1).max(50).default(10),
  }),
}

// ---- handlers: each returns { label, appPath, payload } for a [Dn] source,
// except search_manuals, which registers [Sn] chunks itself.

async function searchManuals(args, ctx) {
  const result = await ctx.deps.retrieve(ctx.userId, args.query)
  ctx.trackSimilarity(result.topSimilarity)
  if (!result.sufficient) {
    return { manual: true, response: { sufficient: false, chunks: [], note: 'No manual passage passed the relevance threshold. The manuals do not cover this query.' } }
  }
  const tags = result.chunks.map((c) => ctx.registry.addChunk(c))
  return { manual: true, response: { sufficient: true, sources: tags.map((t) => ctx.registry.formatChunk(t)).join('\n\n') } }
}

async function listParcels(args, ctx) {
  const parcels = await ctx.deps.access.listParcels(ctx.userId)
  return {
    label: L(ctx, 'Vaše parcele', 'Your parcels'),
    appPath: '/parcele',
    payload: parcels.map((p) => ({ id: String(p._id), name: p.name, crop: p.vrsta_useva, area: p.povrsina, created: p.date })),
  }
}

const ACTIVITY_META = new Set(['_id', '__v', 'id', 'user', 'parcel', 'kind', 'createdAt', 'updatedAt'])

async function getActivities(args, ctx) {
  let parcelName = null
  if (args.parcelId) {
    const parcel = await ctx.deps.access.findOwnedParcel(ctx.userId, args.parcelId)
    if (!parcel) return { label: L(ctx, 'Aktivnosti', 'Activities'), appPath: '/aktivnosti', payload: { error: 'parcel not found' } }
    parcelName = parcel.name
  }
  const [rows, parcels] = await Promise.all([
    ctx.deps.access.listActivities(ctx.userId, args),
    ctx.deps.access.listParcels(ctx.userId),
  ])
  const names = new Map(parcels.map((p) => [String(p._id), p.name]))
  const activities = rows.map((a) => {
    const details = {}
    for (const [k, v] of Object.entries(a)) {
      if (!ACTIVITY_META.has(k) && v !== null && v !== undefined && v !== '') details[k] = v
    }
    return { parcel: names.get(String(a.parcel)) || null, ...details }
  })
  return {
    label: parcelName ? L(ctx, `Aktivnosti: ${parcelName}`, `Activities: ${parcelName}`) : L(ctx, 'Knjiga polja', 'Activity log'),
    appPath: '/aktivnosti',
    payload: { count: activities.length, activities },
  }
}

async function listDevices(args, ctx) {
  const { ttn, chirp } = await ctx.deps.access.listDevices(ctx.userId)
  const devices = await Promise.all(ttn.map(async (d) => ({
    devId: d.dev_id,
    name: d.name,
    network: 'TTN',
    variables: await ctx.deps.access.deviceVariables(d.dev_id),
    lastReadingAt: await ctx.deps.access.lastReadingAt(d.dev_id),
    canReceiveDownlink: Boolean(d.downpush),
  })))
  for (const d of chirp) {
    devices.push({ devEui: d.dev_eui, name: d.name, network: 'Chirpstack', note: 'no telemetry or rules support yet' })
  }
  return { label: L(ctx, 'Vaši uređaji', 'Your devices'), appPath: '/uredjaji', payload: { timezone: 'UTC', devices } }
}

async function getTelemetry(args, ctx) {
  const label = L(ctx, `Telemetrija: ${args.devId}, poslednjih ${args.hours} h`, `Telemetry: ${args.devId}, last ${args.hours} h`)
  const device = await ctx.deps.access.findOwnedDevice(ctx.userId, args.devId)
  if (!device) return { label, appPath: '/uredjaji', payload: { error: 'device not found among your TTN devices' } }

  const since = new Date(ctx.now() - args.hours * 3600e3).toISOString().slice(0, 19)
  const rows = await ctx.deps.access.readings(args.devId, { variables: args.variables, since, limit: 2000 })

  const byVar = new Map()
  for (const r of rows) {
    if (!byVar.has(r.name)) byVar.set(r.name, [])
    byVar.get(r.name).push(r)
  }
  const variables = {}
  for (const [name, list] of byVar) {
    const nums = list
      .map((r) => r.value)
      .filter((v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''))
      .map(Number)
      .filter(Number.isFinite)
    variables[name] = {
      count: list.length,
      latest: { value: list[0].value, at: list[0].date_time },
      ...(nums.length ? {
        min: round(Math.min(...nums)),
        max: round(Math.max(...nums)),
        avg: round(nums.reduce((s, v) => s + v, 0) / nums.length),
      } : {}),
      recent: list.slice(0, 10).map((r) => ({ value: r.value, at: r.date_time })),
    }
  }
  return {
    label,
    appPath: '/uredjaji',
    payload: { devId: args.devId, name: device.name, windowHours: args.hours, since, timezone: 'UTC', truncated: rows.length === 2000, variables },
  }
}

function decodePayload(payload) {
  try {
    const text = Buffer.from(payload.frm_payload, 'base64').toString('utf8')
    return /^[\x20-\x7E]*$/.test(text) ? text : null
  } catch {
    return null
  }
}

async function listRules(args, ctx) {
  const rules = await ctx.deps.access.listRules(ctx.userId)
  return {
    label: L(ctx, 'Vaše automatizacije', 'Your automation rules'),
    appPath: '/automatizacije',
    payload: rules.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      combinator: r.combinator,
      clauses: r.clauses,
      action: r.target_dev_id ? { targetDevId: r.target_dev_id, payloadText: r.payload ? decodePayload(r.payload) : null } : null,
      lastFiredAt: r.last_fired_at,
    })),
  }
}

async function getRuleHistory(args, ctx) {
  const label = L(ctx, `Istorija pravila #${args.ruleId}`, `Rule #${args.ruleId} history`)
  const rule = await ctx.deps.access.ruleOwned(ctx.userId, args.ruleId)
  if (!rule) return { label, appPath: '/automatizacije', payload: { error: 'rule not found' } }
  const rows = await ctx.deps.access.ruleHistory(ctx.userId, args.ruleId, args.limit)
  return { label: `${label} (${rule.name})`, appPath: '/automatizacije', payload: { ruleId: rule.id, name: rule.name, firings: rows } }
}

async function proposeRuleTool(args, ctx) {
  const result = await ctx.deps.proposeRule(ctx.userId, args, { lang: ctx.lang })
  if (result.ok) ctx.proposals.push(result.proposal)
  const payload = result.ok
    ? {
        status: 'pending_user_confirmation',
        proposalId: result.proposal.id,
        summary: result.proposal.summary,
        warnings: result.proposal.warnings,
        note: 'Not created yet. The user must press Confirm under your answer; the rule then starts disabled.',
      }
    : result
  return { label: L(ctx, 'Predlog automatizacije', 'Automation proposal'), appPath: '/automatizacije', payload }
}

const handlers = {
  search_manuals: searchManuals,
  list_parcels: listParcels,
  get_activities: getActivities,
  list_devices: listDevices,
  get_telemetry: getTelemetry,
  list_rules: listRules,
  get_rule_history: getRuleHistory,
  propose_rule: proposeRuleTool, // validates its own args (ruleProposal.js)
}

// Runs one call and returns the functionResponse body for Gemini.
async function runTool(call, ctx) {
  const handler = handlers[call.name]
  if (!handler) return { error: `unknown tool ${call.name}` }

  ctx.toolsUsed.push(call.name)
  const schema = schemas[call.name]
  let args = call.args || {}
  if (schema) {
    const parsed = schema.safeParse(args)
    if (!parsed.success) {
      return { error: 'invalid arguments', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
    }
    args = parsed.data
  }

  try {
    const result = await handler(args, ctx)
    if (result.manual) return result.response
    const tag = ctx.registry.addData(result.label, result.payload, result.appPath)
    if (!result.payload || !result.payload.error) ctx.dataSourcesOk++
    return { tag, data: result.payload }
  } catch (err) {
    console.error(`assistant tool ${call.name} failed:`, err)
    return { error: 'tool failed' }
  }
}

module.exports = { declarations, runTool, ACTIVITY_TYPES }
