import axios from 'axios'
const origin = 'http://localhost:3001'
const baseUrl = '/api/users'

const register = async credentials => {
  console.log("this works");
  const response = await axios.post(origin+baseUrl, credentials)
  
  return response.status
}

export default  {register}