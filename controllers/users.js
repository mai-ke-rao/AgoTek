const usersRouter = require('express').Router()
const bcrypt = require('bcrypt')
const User = require('../models/user')


usersRouter.post('/', async(request, response, next) =>
{

  try{
const {username, name, password} = request.body
if(password.length>2 && password){
const saltRounds = 10
  const passwordHash = await bcrypt.hash(password, saltRounds)
  const user = new User({
    username,
    name,
    passwordHash,
  })

  const savedUser = await user.save()
  response.status(201).json(savedUser)
}else { 
  console.log("bad user or password")
  response.status(400).end();}

}catch (err) {
  return next(err);
}
})


module.exports = usersRouter