const { test, expect } = require('@playwright/test');
const {
  connectTestDb,
  disconnectTestDb,
  clearTtnData,
  createTestUser,
  createTestDevice,
  signToken,
} = require('./helpers/db');
const { startMockTtnServer } = require('./helpers/mockTtnServer');

const APIKEY = 'test-apikey-for-downlink-spec';
const DEV_ID = 'downlink-test-device';

test.describe('TTN downlink push (POST /api/TTN/send-downlink)', () => {
  let mockTtn;

  test.beforeAll(async () => {
    await connectTestDb();
  });

  test.afterAll(async () => {
    await disconnectTestDb();
  });

  test.beforeEach(async () => {
    await clearTtnData();
    mockTtn = await startMockTtnServer();
  });

  test.afterEach(async () => {
    await mockTtn.close();
  });

  test('forwards the downlink payload to the device downpush URL with a bearer apikey', async ({ request }) => {
    const user = await createTestUser();
    await createTestDevice({ user, dev_id: DEV_ID, apikey: APIKEY, downpush: mockTtn.url });
    const token = signToken(user);

    const downlinkPayload = { f_port: 1, frm_payload: Buffer.from([1, 2, 3]).toString('base64') };

    const response = await request.post('/api/TTN/send-downlink', {
      headers: { Authorization: `Bearer ${token}` },
      data: { dev_id: DEV_ID, downlinkPayload },
    });
    expect(response.status()).toBe(200);

    expect(mockTtn.requests).toHaveLength(1);
    const received = mockTtn.requests[0];
    expect(received.headers['authorization']).toBe(`Bearer ${APIKEY}`);
    expect(received.body).toEqual({ downlinks: [downlinkPayload] });
  });
});
