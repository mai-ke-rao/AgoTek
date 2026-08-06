require('dotenv').config()

const PORT = process.env.PORT || 3002
const SECRET = process.env.SECRET
const MONGODB_URI = process.env.NODE_ENV === 'test'
  ? process.env.MONGODB_URI_TEST
  : process.env.MONGODB_URI
const DATABASE_URL = process.env.DATABASE_URL

module.exports = {
    MONGODB_URI,
    DATABASE_URL,
    PORT,
    SECRET
}
