require('dotenv').config()

const PORT = process.env.PORT || 3002
const SECRET = process.env.SECRET
const MONGODB_URI = process.env.NODE_ENV === 'test'
  ? process.env.MONGODB_URI_TEST
  : process.env.MONGODB_URI

module.exports = {
    MONGODB_URI,
    PORT,
    SECRET
}
