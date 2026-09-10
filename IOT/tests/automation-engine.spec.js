const { test, expect } = require('@playwright/test');
const {
  connectTestDb,
  disconnectTestDb,
  clearTtnData,
  createTestUser,
  createTestDevice,
  signToken,
} = require('./helpers/db');
const { clearAutomationData, queryAutomationDb, closeAutomationDb } = require('./helpers/automationDb');
const { startMockTtnServer } = require('./helpers/mockTtnServer');
const { buildUplinkPayload, buildUplinkHeaders } = require('./fixtures/ttnUplink');
const Device = require('../models/device');

// §7.2 — the firing loop against real Postgres + Mongo, driven through the
// real TTN webhook. Evaluation is fire-and-forget behind the 200, so
// assertions poll the mock TTN endpoint / audit log rather than the response.

const SENSOR = 'engine-sensor';
const SENSOR_KEY = 'engine-sensor-key';
const VALVE = 'engine-valve';
const VALVE_KEY = 'engine-valve-key';
const PAYLOAD = { f_port: 1, frm_payload: 'AQ==' };

const SETTLE_MS = 700; // long enough for a would-be fire to land before asserting it didn't

test.describe('automation engine (uplink → rule → downlink)', () => {
  let mockTtn;
  let user;
  let token;

  test.beforeAll(async () => {
    await connectTestDb();
  });

  test.afterAll(async () => {
    await disconnectTestDb();
    await closeAutomationDb();
  });

  test.beforeEach(async () => {
    await Promise.all([clearTtnData(), clearAutomationData()]);
    mockTtn = await startMockTtnServer();
    user = await createTestUser();
    token = signToken(user);
    await createTestDevice({ user, dev_id: SENSOR, apikey: SENSOR_KEY });
    // downpush is what TTN hands us with the device's first uplink
    await createTestDevice({ user, dev_id: VALVE, apikey: VALVE_KEY, downpush: mockTtn.url });
  });

  test.afterEach(async () => {
    await mockTtn.close();
  });

  const uplink = (request, { devId = SENSOR, apikey = SENSOR_KEY, fCnt, readings }) =>
    request.post('/api/TTN', {
      headers: buildUplinkHeaders({ apikey }),
      data: buildUplinkPayload({ devId, fCnt, decodedPayload: readings }),
    });

  const createRule = async (request, overrides = {}) => {
    const response = await request.post('/api/rules', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'temp high',
        combinator: 'AND',
        enabled: true,
        clauses: [{ devId: SENSOR, variable: 'temperature', comparator: 'gt', threshold: 30 }],
        action: { type: 'downlink', targetDevId: VALVE, payload: PAYLOAD },
        ...overrides,
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).rule;
  };

  const audit = async (request, ruleId) => {
    const response = await request.get(`/api/rules/${ruleId}/audit/1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    return response.json();
  };

  const expectFires = (n) => expect.poll(() => mockTtn.requests.length, { timeout: 5_000 }).toBe(n);
  const expectNoFire = async (n = 0) => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    expect(mockTtn.requests).toHaveLength(n);
  };

  test('fires the downlink, audits it and stamps rule_state when the condition is true', async ({ request }) => {
    const rule = await createRule(request);

    const response = await uplink(request, { fCnt: 1, readings: { temperature: 35 } });
    expect(response.status()).toBe(200);

    await expectFires(1);
    const sent = mockTtn.requests[0];
    expect(sent.headers.authorization).toBe(`Bearer ${VALVE_KEY}`);
    expect(sent.body).toEqual({ downlinks: [PAYLOAD] });

    await expect.poll(async () => (await audit(request, rule.id)).length).toBe(1);
    const [row] = await audit(request, rule.id);
    expect(row.status).toBe('ok');
    expect(row.targetDevId).toBe(VALVE);
    expect(row.snapshot).toEqual({ fCnt: 1, [`${SENSOR}:temperature`]: 35 });

    const [state] = await queryAutomationDb('SELECT last_fired_at FROM rule_state WHERE rule_id = $1', [rule.id]);
    expect(state.last_fired_at).not.toBeNull();
  });

  test('does not fire when the condition is false', async ({ request }) => {
    const rule = await createRule(request);

    await uplink(request, { fCnt: 1, readings: { temperature: 10 } });

    await expectNoFire();
    expect(await audit(request, rule.id)).toEqual([]);
  });

  test('does not fire a disabled rule', async ({ request }) => {
    await createRule(request, { enabled: false });

    await uplink(request, { fCnt: 1, readings: { temperature: 35 } });

    await expectNoFire();
  });

  test('replaying the same f_cnt fires once (idempotency cursor)', async ({ request }) => {
    const rule = await createRule(request);

    await uplink(request, { fCnt: 7, readings: { temperature: 35 } });
    await expectFires(1);
    await uplink(request, { fCnt: 7, readings: { temperature: 35 } });

    await expectNoFire(1);
    expect(await audit(request, rule.id)).toHaveLength(1);

    const [cursor] = await queryAutomationDb('SELECT last_f_cnt FROM device_cursor WHERE dev_id = $1', [SENSOR]);
    expect(cursor.last_f_cnt).toBe(7);
  });

  test('a new f_cnt with the condition still true fires again (no edge-trigger, no cooldown)', async ({ request }) => {
    await createRule(request);

    await uplink(request, { fCnt: 1, readings: { temperature: 35 } });
    await expectFires(1);
    await uplink(request, { fCnt: 2, readings: { temperature: 36 } });
    await expectFires(2);
  });

  test('survives a frame-counter reset (rejoin) instead of ignoring the device', async ({ request }) => {
    await createRule(request);

    await uplink(request, { fCnt: 40, readings: { temperature: 35 } });
    await expectFires(1);
    await uplink(request, { fCnt: 1, readings: { temperature: 35 } });
    await expectFires(2);
  });

  test('cross-device AND clause reads the other device\'s latest Bucket value', async ({ request }) => {
    const SENSOR2 = 'engine-sensor-2';
    const SENSOR2_KEY = 'engine-sensor-2-key';
    await createTestDevice({ user, dev_id: SENSOR2, apikey: SENSOR2_KEY });

    const rule = await createRule(request, {
      clauses: [
        { devId: SENSOR, variable: 'temperature', comparator: 'gt', threshold: 30 },
        { devId: SENSOR2, variable: 'humidity', comparator: 'lt', threshold: 50 },
      ],
    });

    // sensor2 reports first: temperature has never been seen → AND is false
    await uplink(request, { devId: SENSOR2, apikey: SENSOR2_KEY, fCnt: 1, readings: { humidity: 40 } });
    await expectNoFire();

    // sensor reports: humidity(40) comes back from Bucket → both true → fires
    await uplink(request, { fCnt: 1, readings: { temperature: 35 } });
    await expectFires(1);

    const [row] = await audit(request, rule.id);
    expect(row.snapshot).toEqual({
      fCnt: 1,
      [`${SENSOR}:temperature`]: 35,
      [`${SENSOR2}:humidity`]: 40,
    });
  });

  test('records a failed audit row when TTN rejects the downlink, and the webhook still acks 200', async ({ request }) => {
    const rule = await createRule(request);
    mockTtn.setNextResponse({ status: 500, body: { error: 'ttn down' } });

    const response = await uplink(request, { fCnt: 1, readings: { temperature: 35 } });
    expect(response.status()).toBe(200);

    await expectFires(1);
    await expect.poll(async () => (await audit(request, rule.id)).length).toBe(1);
    const [row] = await audit(request, rule.id);
    expect(row.status).toBe('failed');
    expect(row.detail).toBe('TTN responded 500');
  });

  test('error isolation: a rule whose target device is gone is skipped, others still fire', async ({ request }) => {
    const VALVE2 = 'engine-valve-2';
    await createTestDevice({ user, dev_id: VALVE2, apikey: 'valve-2-key', downpush: mockTtn.url });
    const doomed = await createRule(request, { name: 'doomed', action: { type: 'downlink', targetDevId: VALVE2, payload: PAYLOAD } });
    const healthy = await createRule(request, { name: 'healthy' });

    // Ownership is re-validated before every fire (§6.1) — pull the rug.
    await Device.deleteOne({ dev_id: VALVE2 });

    await uplink(request, { fCnt: 1, readings: { temperature: 35 } });

    await expectFires(1);
    await expectNoFire(1);
    expect(mockTtn.requests[0].headers.authorization).toBe(`Bearer ${VALVE_KEY}`);
    expect(await audit(request, doomed.id)).toEqual([]);
    expect(await audit(request, healthy.id)).toHaveLength(1);
  });

  test('kill switch stops a rule that was firing', async ({ request }) => {
    await createRule(request);

    await uplink(request, { fCnt: 1, readings: { temperature: 35 } });
    await expectFires(1);

    const killed = await request.post('/api/rules/kill-switch', {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(await killed.json()).toEqual({ disabled: 1 });

    await uplink(request, { fCnt: 2, readings: { temperature: 35 } });
    await expectNoFire(1);
  });

  test('an uplink with no f_cnt is still evaluated (no idempotency key to skip on)', async ({ request }) => {
    await createRule(request);

    await uplink(request, { readings: { temperature: 35 } });

    await expectFires(1);
  });
});
