const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3
  },
  name: String,
  passwordHash: String
})

userSchema.virtual("parcels", {
  ref: "Parcel",
  localField: "_id",
  foreignField: "user"
});

userSchema.virtual("devices", {
  ref: "Device",
  localField: "_id",
  foreignField: "user"
});


userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    // the passwordHash should not be revealed
    delete returnedObject.passwordHash
  }
})

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

const User = mongoose.model('User', userSchema)

module.exports = User


