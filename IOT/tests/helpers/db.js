const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/user');
const Device = require('../../models/device');
const Bucket = require('../../models/bucket');
const { encrypt } = require('../../utils/cryptoHelper');

// Refuses to run destructive calls against any database whose name doesn't
// obviously say "test" — cheap insurance against MONGODB_URI_TEST ever
// pointing at the real "Farma" database again.
function assertSafeTestDatabase() {
  const name = mongoose.connection.name || '';
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to run destructive TTN tests against database "${name}" ` +
      `(MONGODB_URI_TEST) — its name doesn't contain "test".`
    );
  }
}

async function connectTestDb() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  }
  assertSafeTestDatabase();
}

async function disconnectTestDb() {
  await mongoose.disconnect();
}

// Wipes just the collections these TTN tests touch, so runs don't
// interfere with anything else that might use the same test database.
async function clearTtnData() {
  assertSafeTestDatabase();
  await Promise.all([
    User.deleteMany({}),
    Device.deleteMany({}),
    Bucket.deleteMany({}),
  ]);
}

async function createTestUser(overrides = {}) {
  const user = new User({
    username: `ttn-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: 'TTN Test User',
    passwordHash: 'not-used-in-these-tests',
    ...overrides,
  });
  return user.save();
}

async function createTestDevice({ user, dev_id, apikey, downpush, name = 'Test device' }) {
  const device = new Device({
    name,
    apikey_encrypted: encrypt(apikey),
    dev_id,
    downpush,
    user: user._id,
  });
  return device.save();
}

// Mirrors Backend/controllers/login.js's token payload shape so it decodes
// the same way through IOT's shared getUserFromToken.
function signToken(user) {
  return jwt.sign({ username: user.username, id: user._id }, process.env.SECRET);
}

module.exports = {
  connectTestDb,
  disconnectTestDb,
  clearTtnData,
  createTestUser,
  createTestDevice,
  signToken,
};
