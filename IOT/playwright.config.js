
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { defineConfig } = require('@playwright/test');

// Dedicated port so this never collides with a dev server already running on
// the default 3002.
const PORT = process.env.TEST_PORT || 3099;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  // App.js requires automation/index.ts, which plain `node` can't resolve —
  // has to boot through tsx, same as the "dev" npm script does.
  webServer: {
    command: 'npx tsx index.js',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
    },
  },
});
