#!/usr/bin/env node
// npm run db:migrate — the same migrations Backend applies at startup.
require('dotenv').config()
const { migrate } = require('../assistant/migrate')
const db = require('../assistant/db')

migrate()
  .then(() => console.log('assistant migrations up to date'))
  .catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
  .finally(() => db.close())
