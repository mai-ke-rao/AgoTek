const config = require('./utils/config')
const express = require('express')
const app = express()
const http = require('http');
const cors = require('cors')
const mongoose = require('mongoose')
const middleware = require('./utils/middleware')
const parcelsRouter = require('./controllers/parcels')
const usersRouter = require('./controllers/users')
const loginRouter = require('./controllers/login')
const activitesRouter = require('./controllers/activities')
const assistantRouter = require('./assistant/controller')
const assistantConfig = require('./assistant/config')
const fs = require('fs')

mongoose.set('strictQuery', false)

mongoose.connect(config.MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connecting to MongoDB:', error.message)
  })

app.use(cors())
app.use(express.json())

const server = http.createServer(app);

app.use('/api/users', usersRouter)
app.use('/api/login', loginRouter)

app.use(middleware.requestLogger)
app.use(middleware.tokenExtractor)
app.use('/api/activities', activitesRouter)
app.use('/api/parcels', parcelsRouter)
app.use('/api/assistant', assistantRouter)

// The manuals, so citation chips can open the PDF at the cited page. Only
// mounted when the corpus folder is deployed alongside Backend.
if (fs.existsSync(assistantConfig.CORPUS_DIR)) {
  app.use('/manuals', express.static(assistantConfig.CORPUS_DIR, { index: false, extensions: false }))
}

module.exports = { app, server }
