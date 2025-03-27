import axios from 'axios'
const baseUrl = '/api/login'

const login = async credentials => {
  console.log("this works");
  const response = await axios.post(baseUrl, credentials)
  
  return response.data
}

export default  {login}