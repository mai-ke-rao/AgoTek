
const { server } = require('./App')
const config = require('./utils/config')

server.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`)
    // After listen, so a slow embedding-model load never delays login/parcels.
    require('./assistant').init()
  })
