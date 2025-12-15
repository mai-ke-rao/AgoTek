import axios from 'axios'

const baseUrl = '/api/users'

const register = async credentials => {
  console.log("this works");
  const response = await axios.post(baseUrl, credentials)
  
  return response.status
}

export default  {register}