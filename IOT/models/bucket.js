const mongoose = require('mongoose')

const bucketSchema = new mongoose.Schema({
    name: String,
    value: mongoose.Schema.Types.Mixed,
    date_time: String,
    dev_id: String,
})

// latest-value lookups per device+variable (§3.3 AUTOMATION_SPEC.md)
bucketSchema.index({ dev_id: 1, name: 1, date_time: -1 })

bucketSchema.set('toJSON', {
    transform: (document, returnedObject) => {
      returnedObject.id = returnedObject._id.toString()
      delete returnedObject._id
      delete returnedObject.__v
    }
})

module.exports = mongoose.model('Bucket', bucketSchema)
