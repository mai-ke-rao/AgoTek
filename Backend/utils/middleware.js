const logger = require('./logger')
const jwt = require('jsonwebtoken')
const User = require('../models/user')

const requestLogger = (request, response, next) => {
  logger.info('Method:', request.method)
  logger.info('Path:  ', request.path)
  logger.info('Body:  ', request.body)
  logger.info('Headers:  ', request.headers)
  logger.info('---')
  next()
}

const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: 'unknown endpoint' })
}

const errorHandler = (error, request, response, next) => {
  logger.error(error.message)

  if (error.name === 'CastError') {
    return response.status(400).send({ error: 'malformatted id' })
  } else if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message })
  }else if (error.name ===  'JsonWebTokenError')
   {    return response.status(400).json({ error: error.message })
   }
  next(error)
}
const tokenExtractor = (request, response, next) => {
  const authorization = request.get('authorization') 
  if (authorization && authorization.startsWith('Bearer ')) 
 {   request.token = authorization.replace('Bearer ', '') 
    
}
else{
  response.status(400).send({ error: 'authrization missing'})
}
  next()
}
const userExtractor = async(request, response, next) => {

  logger.info("yoyoyo", request.token)
  const decodedToken = jwt.verify(request.token, process.env.SECRET) 
  if(!decodedToken.id)
  {
    response.status(401).send({ error: 'unautharised access' })
  }
const korisnik = await User.findById(decodedToken.id)

request.user = korisnik
next()
}

module.exports = {
  requestLogger,
  unknownEndpoint,
  errorHandler,
 tokenExtractor,
 userExtractor
}