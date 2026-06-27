const { server } = require('./App')
const config = require('./utils/config')

server.listen(config.PORT, () => {
    console.log(`IoT service running on port ${config.PORT}`)
})
