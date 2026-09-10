const { test, expect } = require('@playwright/test');
const {
  connectTestDb,
  disconnectTestDb,
  clearTtnData,
  createTestUser,
  createTestDevice,
  signToken,
} = require('./helpers/db');
const { clearAutomationData, closeAutomationDb } = require('./helpers/automationDb');

// §7.3 — the HTTP contract: auth, ownership, validation, lifecycle.

const DEV = 'rules-api-device';

const validRule = (overrides = {}) => ({
  name: 'soil dry',
  combinator: 'AND',
  clauses: [{ devId: DEV, variable: 'moisture', comparator: 'lt', threshold: 20 }],
  action: { type: 'downlink', targetDevId: DEV, payload: { f_port: 1, frm_payload: 'AQ==' } },
  ...overrides,
});

test.describe('rules API (/api/rules)', () => {
  let user;
  let auth;

  test.beforeAll(async () => {
    await connectTestDb();
  });

  test.afterAll(async () => {
    await disconnectTestDb();
    await closeAutomationDb();
  });

  test.beforeEach(async () => {
    await Promise.all([clearTtnData(), clearAutomationData()]);
    user = await createTestUser();
    auth = { Authorization: `Bearer ${signToken(user)}` };
    await createTestDevice({ user, dev_id: DEV, apikey: 'rules-api-key' });
  });

  test('401 without a JWT', async ({ request }) => {
    expect((await request.get('/api/rules')).status()).toBe(401);
    expect((await request.post('/api/rules', { data: validRule() })).status()).toBe(401);
    expect((await request.get('/api/rules', { headers: { Authorization: 'Bearer nope' } })).status()).toBe(401);
  });

  test('403 when a clause or the action targets a device the user does not own', async ({ request }) => {
    const other = await createTestUser();
    await createTestDevice({ user: other, dev_id: 'someone-elses', apikey: 'k' });

    const response = await request.post('/api/rules', {
      headers: auth,
      data: validRule({ action: { type: 'downlink', targetDevId: 'someone-elses', payload: {} } }),
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ devIds: ['someone-elses'] });
    expect(await (await request.get('/api/rules', { headers: auth })).json()).toEqual([]);
  });

  test('400 from Zod on malformed payloads', async ({ request }) => {
    const cases = [
      ['no clauses', validRule({ clauses: [] })],
      ['six clauses', validRule({ clauses: Array(6).fill(validRule().clauses[0]) })],
      ['empty name', validRule({ name: '' })],
      ['bad combinator', validRule({ combinator: 'XOR' })],
      ['bad comparator', validRule({ clauses: [{ ...validRule().clauses[0], comparator: 'between' }] })],
      ['string threshold', validRule({ clauses: [{ ...validRule().clauses[0], threshold: 'twenty' }] })],
      ['missing action', { ...validRule(), action: undefined }],
    ];

    for (const [label, data] of cases) {
      const response = await request.post('/api/rules', { headers: auth, data });
      expect(response.status(), label).toBe(400);
    }
  });

  test('full lifecycle: create → get → list → patch → delete', async ({ request }) => {
    const created = await request.post('/api/rules', { headers: auth, data: validRule() });
    expect(created.status()).toBe(201);
    const { rule, clauses, action, state } = await created.json();
    expect(rule).toMatchObject({ name: 'soil dry', combinator: 'AND', enabled: false, userId: user._id.toString() });
    expect(clauses).toHaveLength(1);
    expect(action.targetDevId).toBe(DEV);
    expect(state).toEqual({ ruleId: rule.id, lastFiredAt: null });

    const fetched = await request.get(`/api/rules/${rule.id}`, { headers: auth });
    expect(fetched.status()).toBe(200);
    expect((await fetched.json()).rule.id).toBe(rule.id);

    const listed = await request.get('/api/rules', { headers: auth });
    expect((await listed.json()).map((r) => r.rule.id)).toEqual([rule.id]);

    const patched = await request.patch(`/api/rules/${rule.id}`, { headers: auth, data: { enabled: true, name: 'renamed' } });
    expect(patched.status()).toBe(200);
    expect(await patched.json()).toMatchObject({ enabled: true, name: 'renamed' });

    const emptyPatch = await request.patch(`/api/rules/${rule.id}`, { headers: auth, data: {} });
    expect(emptyPatch.status()).toBe(400);

    const deleted = await request.delete(`/api/rules/${rule.id}`, { headers: auth });
    expect(deleted.status()).toBe(204);
    expect((await request.get(`/api/rules/${rule.id}`, { headers: auth })).status()).toBe(404);
    expect((await request.get(`/api/rules/${rule.id}/audit/1`, { headers: auth })).status()).toBe(404);
  });

  test("another user's rule is invisible: 404 on get/patch/delete, absent from list", async ({ request }) => {
    const created = await request.post('/api/rules', { headers: auth, data: validRule() });
    const { rule } = await created.json();

    const intruder = { Authorization: `Bearer ${signToken(await createTestUser())}` };

    expect((await request.get(`/api/rules/${rule.id}`, { headers: intruder })).status()).toBe(404);
    expect((await request.patch(`/api/rules/${rule.id}`, { headers: intruder, data: { enabled: true } })).status()).toBe(404);
    expect((await request.delete(`/api/rules/${rule.id}`, { headers: intruder })).status()).toBe(404);
    expect(await (await request.get('/api/rules', { headers: intruder })).json()).toEqual([]);

    // and it's still there, untouched, for the owner
    const mine = await (await request.get(`/api/rules/${rule.id}`, { headers: auth })).json();
    expect(mine.rule.enabled).toBe(false);
  });

  test('400 on a non-integer id', async ({ request }) => {
    expect((await request.get('/api/rules/abc', { headers: auth })).status()).toBe(400);
    expect((await request.get('/api/rules/1/audit/zero', { headers: auth })).status()).toBe(400);
    expect((await request.get('/api/rules/1/audit/0', { headers: auth })).status()).toBe(400);
  });

  test('kill switch disables everything, or only rules touching one device', async ({ request }) => {
    await createTestDevice({ user, dev_id: 'other-dev', apikey: 'k2' });
    const mk = async (overrides) =>
      (await (await request.post('/api/rules', { headers: auth, data: validRule({ enabled: true, ...overrides }) })).json()).rule;

    const onDev = await mk({ name: 'on dev' });
    const onOther = await mk({
      name: 'on other',
      clauses: [{ devId: 'other-dev', variable: 'x', comparator: 'gt', threshold: 1 }],
      action: { type: 'downlink', targetDevId: 'other-dev', payload: {} },
    });

    const scoped = await request.post('/api/rules/kill-switch', { headers: auth, data: { devId: DEV } });
    expect(await scoped.json()).toEqual({ disabled: 1 });
    expect((await (await request.get(`/api/rules/${onDev.id}`, { headers: auth })).json()).rule.enabled).toBe(false);
    expect((await (await request.get(`/api/rules/${onOther.id}`, { headers: auth })).json()).rule.enabled).toBe(true);

    const all = await request.post('/api/rules/kill-switch', { headers: auth, data: {} });
    expect(await all.json()).toEqual({ disabled: 1 });
    expect((await (await request.get(`/api/rules/${onOther.id}`, { headers: auth })).json()).rule.enabled).toBe(false);

    const again = await request.post('/api/rules/kill-switch', { headers: auth, data: {} });
    expect(await again.json()).toEqual({ disabled: 0 });
  });

  test('audit is empty for a rule that has never fired', async ({ request }) => {
    const { rule } = await (await request.post('/api/rules', { headers: auth, data: validRule() })).json();
    const response = await request.get(`/api/rules/${rule.id}/audit/1`, { headers: auth });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
