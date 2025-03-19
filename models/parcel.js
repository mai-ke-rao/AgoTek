const mongoose = require('mongoose')

const parcelSchema = new mongoose.Schema({
    name: String,
    city: String,
    user: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
})


parcelSchema.set('toJSON', {
    transform: (document, returnedObject) => {
      returnedObject.id = returnedObject._id.toString()
      delete returnedObject._id
      delete returnedObject.__v
    }
  })
  
  module.exports = mongoose.model('Parcel', parcelSchema)