const user = await User.findOne({ username })


const passwordCorrect = user === null? false : await bcrypt.compare(password, user.passwordHash)


const userForToken = {
  username: user.username,
  id: user._id,}
const token = jwt.sign(userForToken, process.env.SECRET)


await Device.findOne({dev_id: dev_id})

jwt.verify(device.apikey_encrypted, process.env.SECRET)