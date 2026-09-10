const { server } = require('./App')
const config = require('./utils/config')

// §6.3: one process runs ingestion and automation, so an escaped throw would
// take down the webhook too. Log instead of letting Node's default terminate;
// the host restarts on anything that still gets through.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
})

server.listen(config.PORT, () => {
    console.log(`IoT service running on port ${config.PORT}`)
})
