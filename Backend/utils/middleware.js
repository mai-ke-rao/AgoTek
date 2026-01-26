const logger = require('./logger')
const jwt = require('jsonwebtoken')
const User = require('../models/user')

const requestLogger = (request, response, next) => {
  logger.info('Method:', request.method)
  logger.info('Path:  ', request.path)
  logger.info('Body:  ', request.body)
  /*logger.info('Headers:  ', request.headers)*/
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
  try{
  const authorization = request.get('authorization') 
  if (authorization && authorization.startsWith('Bearer ')) 
 {   request.token = authorization.replace('Bearer ', '') 
    
}
else{
  request.token = null;
}

  next()
}catch(e){
  return response.status(401).send({ error: 'authrization error'})
}

}

              const getUserFromToken = async (token) => {

              const decodedToken = jwt.verify(token, process.env.SECRET) 
                if(!decodedToken.id)
                {
                  return response.status(401).send({ error: 'unautharised access' })
                }
              
              const korisnik = await User.findById(decodedToken.id)
              return korisnik
              };


const userExtractor = async(request, response, next) => {

  

  try{
  logger.info("request token is: ", request.token)
  

request.user = await getUserFromToken(request.token)
  logger.info("request user is: ", request.user)
  logger.info("request user.id is: ", request.user.id)
  logger.info("request user._id is: ", request.user._id)


next()
  }catch(e)
  {
    return response.status(401).send({ error: 'auth error' })
  }


}



const socketAuth = async (socket, next) => {
  try {
    
     console.log('🔐 Socket auth - handshake.auth:', socket.handshake.auth);
    const token = socket.handshake.auth?.token;

        if (!token) {
      console.log('❌ No token in handshake.auth');
      return next(new Error('Unauthorized'));
    }

    const user = await getUserFromToken(token);

    if (!user) {
      console.log('❌ No user for token');
      return next(new Error('Unauthorized'));
    }

      console.log('✅ Authenticated socket user:', user.id);
    socket.user = user; // like request.user
    
    next();
  } catch (err) {
    next(new Error('Unauthorized'));
  }
};

module.exports = {
  requestLogger,
  unknownEndpoint,
  errorHandler,
 tokenExtractor,
 userExtractor,
 socketAuth
}