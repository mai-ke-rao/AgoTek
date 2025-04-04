const config = require('./utils/config')
const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
const middleware = require('./utils/middleware')
const parcelsRouter = require('./controllers/parcels')
const usersRouter = require('./controllers/users')
const loginRouter = require('./controllers/login')
const TTNRouter = require('./controllers/TTN')
const activitesRouter = require('./controllers/activities')




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
app.use('/api/users', usersRouter)
app.use('/api/login', loginRouter)
app.use('/api/TTN', TTNRouter)
app.use(middleware.tokenExtractor)
app.use(middleware.requestLogger)
app.use('/api/activities', activitesRouter)
app.use('/api/parcels', parcelsRouter)



module.exports = app