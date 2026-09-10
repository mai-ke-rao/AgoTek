const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { Pool } = require('pg');

// Same insurance as assertSafeTestDatabase in db.js, for the Postgres side:
// these tests truncate the rules tables, so they only ever run against a
// local database.
function assertLocalPostgres() {
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error(
      `Refusing to truncate automation tables on "${host}" (DATABASE_URL) — not a local database.`
    );
  }
}

let pool;

function getPool() {
  if (!pool) {
    assertLocalPostgres();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

// rules cascades to clauses, action, state and audit; device_cursor is the
// only other root table.
async function clearAutomationData() {
  await getPool().query('TRUNCATE rules, device_cursor RESTART IDENTITY CASCADE');
}

async function queryAutomationDb(text, params) {
  const { rows } = await getPool().query(text, params);
  return rows;
}

async function closeAutomationDb() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { clearAutomationData, queryAutomationDb, closeAutomationDb };
