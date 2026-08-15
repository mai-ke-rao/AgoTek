const { test, expect } = require('@playwright/test');
const {
  connectTestDb,
  disconnectTestDb,
  clearTtnData,
  createTestUser,
  createTestDevice,
} = require('./helpers/db');
const { buildUplinkPayload, buildUplinkHeaders } = require('./fixtures/ttnUplink');
const Bucket = require('../models/bucket');
const Device = require('../models/device');

const APIKEY = 'test-apikey-for-uplink-spec';
const DEV_ID = 'uplink-test-device';

test.describe('TTN uplink webhook (POST /api/TTN)', () => {
  test.beforeAll(async () => {
    await connectTestDb();
  });

  test.afterAll(async () => {
    await disconnectTestDb();
  });

  test.beforeEach(async () => {
    await clearTtnData();
    const user = await createTestUser();
    await createTestDevice({ user, dev_id: DEV_ID, apikey: APIKEY });
  });

  test('stores each decoded field as a Bucket row and records downpush', async ({ request }) => {
    const payload = buildUplinkPayload({ devId: DEV_ID });
    const headers = buildUplinkHeaders({
      apikey: APIKEY,
      downlinkPush:
        'https://eu1.cloud.thethings.network/api/v3/as/applications/novappprroba/webhooks/proba-hook/devices/uplink-test-device/down/push',
    });

    const response = await request.post('/api/TTN', { headers, data: payload });
    expect(response.status()).toBe(200);

    const rows = await Bucket.find({ dev_id: DEV_ID }).lean();
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.value]));
    expect(byName).toEqual(payload.uplink_message.decoded_payload);

    const device = await Device.findOne({ dev_id: DEV_ID }).lean();
    expect(device.downpush).toBe(headers['x-downlink-push']);
  });

  test('rejects an uplink with the wrong apikey and stores nothing', async ({ request }) => {
    const payload = buildUplinkPayload({ devId: DEV_ID });
    const headers = buildUplinkHeaders({ apikey: 'not-the-real-key' });

    const response = await request.post('/api/TTN', { headers, data: payload });
    expect(response.status()).toBe(401);

    const rows = await Bucket.find({ dev_id: DEV_ID }).lean();
    expect(rows).toHaveLength(0);
  });

  test('returns 404 for an unknown device', async ({ request }) => {
    const payload = buildUplinkPayload({ devId: 'no-such-device' });
    const headers = buildUplinkHeaders({ apikey: APIKEY });

    const response = await request.post('/api/TTN', { headers, data: payload });
    expect(response.status()).toBe(404);
  });
});
