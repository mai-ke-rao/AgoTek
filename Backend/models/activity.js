const mongoose = require('mongoose')

const activitySchema = new mongoose.Schema({
    datum_od: {
        type: String,
        required: true
    },
    datum_do: {
        type: String,
        required: true
    },
    activityType: {
        type: String,
        required: true
    },
    tip_obrade: {
        type: String,
        required: true
    },
    dubina: Number,
    komentar: String,
    cena_operacije_h: Number,
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    parcel: {type: mongoose.Schema.Types.ObjectId, ref: 'Parcel' }
      
})


activitySchema.set('toJSON', {
    transform:(document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
      }
})

module.exports = mongoose.model('Activity', activitySchema)