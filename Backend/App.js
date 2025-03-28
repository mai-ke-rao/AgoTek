const config = require('./utils/config')
const express = require('express')
const app = express()
const mongoose = require('mongoose')
const middleware = require('./utils/middleware')
const parcelsRouter = require('./controllers/parcels')
const usersRouter = require('./controllers/users')
const loginRouter = require('./controllers/login')




mongoose.set('strictQuery', false)

mongoose.connect(config.MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB')
   
  })
  .catch((error) => {
    console.log('error connecting to MongoDB:', error.message)
  })



app.use(express.json())
app.use('/api/users', usersRouter)
app.use('/api/login', loginRouter)
app.use(middleware.tokenExtractor)
app.use('/api/parcels', parcelsRouter)



module.exports = app