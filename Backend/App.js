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
const TTNRouter = require('./controllers/TTN')
const activitesRouter = require('./controllers/activities')
const ChripstackRouter = require('./controllers/Chirpstack')
const { Server } = require('socket.io');
const socketController = require('./controllers/socketController');



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

const io = new Server(server, {
 cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set('io', io);

io.use(middleware.socketAuth);

socketController(io);

app.use('/api/users', usersRouter)
app.use('/api/login', loginRouter)

app.use(middleware.requestLogger)


app.use(middleware.tokenExtractor)
app.use('/api/TTN', TTNRouter)
app.use('/api/Chirpstack', ChripstackRouter)
app.use('/api/activities', activitesRouter)
app.use('/api/parcels', parcelsRouter)



module.exports = {app, server}