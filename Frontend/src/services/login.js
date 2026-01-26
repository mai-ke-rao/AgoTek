import axios from 'axios'
const origin = import.meta.env.VITE_API_URL
const baseUrl = '/api/login'

const login = async credentials => {
  console.log("this works");
  const response = await axios.post(origin+baseUrl, credentials)
  
  return response.data
}

export default  {login}