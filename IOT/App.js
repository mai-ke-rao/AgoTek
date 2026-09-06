const config = require('./utils/config')
const express = require('express')
const app = express()
const http = require('http');
const cors = require('cors')
const mongoose = require('mongoose')
const middleware = require('./utils/middleware')
const TTNRouter = require('./controllers/TTN')
const ChirpstackRouter = require('./controllers/Chirpstack')
const { Server } = require('socket.io');
const socketController = require('./controllers/socketController');
const { AUTOMATION_MODULE_VERSION } = require('./automation');
const { rulesRouter } = require('./automation/rules/controller');

mongoose.set('strictQuery', false)

mongoose.connect(config.MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB')
    console.log('automation module version:', AUTOMATION_MODULE_VERSION)
  })
  .catch((error) => {
    console.log('error connecting to MongoDB:', error.message)
  })

app.use(cors())
app.use(express.json())

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set('io', io);

io.use(middleware.socketAuth);

socketController(io);

app.use(middleware.requestLogger)
app.get('/health', (request, response) => response.sendStatus(200))
app.use(middleware.tokenExtractor)
app.use('/api/TTN', TTNRouter)
app.use('/api/Chirpstack', ChirpstackRouter)
app.use('/api/rules', rulesRouter)

module.exports = { app, server }
