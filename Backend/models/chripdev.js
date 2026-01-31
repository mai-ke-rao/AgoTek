const mongoose = require('mongoose')


const chirpSchema = new mongoose.Schema({
    name: String,
    apikey_encrypted: String,
    dev_eui: String,
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
})
/*
chirpSchema.index({ dev_eui: 1 }, { unique: true });
*/

chirpSchema.set('toJSON', {
    transform: (document, returnedObject) => {
      returnedObject.id = returnedObject._id.toString()
      delete returnedObject._id
      delete returnedObject.__v
    }
  })
  
  module.exports = mongoose.model('Chirpdev', chirpSchema)