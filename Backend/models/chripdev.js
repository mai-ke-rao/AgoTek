const mongoose = require('mongoose')


const deviceSchema = new mongoose.Schema({
    name: String,
    apikey_encrypted: String,
    dev_id: String,
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
})

deviceSchema.set('toJSON', {
    transform: (document, returnedObject) => {
      returnedObject.id = returnedObject._id.toString()
      delete returnedObject._id
      delete returnedObject.__v
    }
  })
  
  module.exports = mongoose.model('Device', deviceSchema)