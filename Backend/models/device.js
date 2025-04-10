const mongoose = require('mongoose')


const deviceSchema = new mongoose.Schema({
    name: String,
    apikey_hash: String
})

deviceSchema.set('toJSON', {
    transform: (document, returnedObject) => {
      returnedObject.id = returnedObject._id.toString()
      delete returnedObject._id
      delete returnedObject.__v
    }
  })
  
  module.exports = mongoose.model('Device', deviceSchema)