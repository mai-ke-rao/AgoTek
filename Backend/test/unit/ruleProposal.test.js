const { test } = require('node:test')
const assert = require('node:assert/strict')
const { proposeRule, iotRuleSchema } = require('../../assistant/ruleProposal')

function fakes({ owned = ['soil-1', 'valve-1'], seen = ['soil-1:moisture'] } = {}) {
  const stored = []
  return {
    stored,
    access: {
      ownedDeviceIds: async (userId, devIds) => new Set(userId === 'u1' ? devIds.filter((d) => owned.includes(d)) : []),
      variableSeen: async (devId, variable) => seen.includes(`${devId}:${variable}`),
    },
    store: async (p) => { stored.push(p); return { id: 'p-1', expires_at: '2026-11-06T12:30:00Z' } },
  }
}

const args = (overrides = {}) => ({
  name: 'Suvo zemljište',
  combinator: 'AND',
  clauses: [{ devId: 'soil-1', variable: 'moisture', comparator: 'lt', threshold: 20 }],
  action: { targetDevId: 'valve-1', payloadText: 'OPEN' },
  ...overrides,
})

test('a valid proposal is stored disabled, in the IOT rule shape', async () => {
  const f = fakes()
  const r = await proposeRule('u1', args(), { access: f.access, store: f.store })
  assert.equal(r.ok, true)
  assert.equal(f.stored.length, 1)
  const rule = f.stored[0].rule
  assert.ok(iotRuleSchema.safeParse(rule).success)
  assert.equal(rule.enabled, false)
  assert.equal(rule.action.payload.frm_payload, Buffer.from('OPEN').toString('base64'))
  assert.equal(rule.action.payload.f_port, 1)
  assert.match(r.proposal.summary, /moisture \(soil-1\) < 20/)
})

test('a device the user does not own is rejected without storing anything', async () => {
  const f = fakes({ owned: ['soil-1'] })
  const r = await proposeRule('u1', args(), { access: f.access, store: f.store })
  assert.equal(r.ok, false)
  assert.deepEqual(r.devIds, ['valve-1'])
  assert.equal(f.stored.length, 0)
})

test('schema violations are reported back to the model', async () => {
  const f = fakes()
  const sixClauses = Array.from({ length: 6 }, () => args().clauses[0])
  for (const bad of [
    args({ clauses: [] }),
    args({ clauses: sixClauses }),
    args({ clauses: [{ devId: 'soil-1', variable: 'moisture', comparator: 'below', threshold: 20 }] }),
    args({ action: { targetDevId: 'valve-1', payloadText: 'x'.repeat(60) } }),
    args({ combinator: 'XOR' }),
  ]) {
    const r = await proposeRule('u1', bad, { access: f.access, store: f.store })
    assert.equal(r.ok, false)
    assert.equal(r.error, 'invalid rule')
  }
  assert.equal(f.stored.length, 0)
})

test('a variable the device never reported produces a warning, not a rejection', async () => {
  const f = fakes({ seen: [] })
  const r = await proposeRule('u1', args(), { access: f.access, store: f.store, lang: 'en' })
  assert.equal(r.ok, true)
  assert.match(r.proposal.warnings[0], /never reported "moisture"/)
})
