import axios from 'axios'
const origin = 'http://localhost:3001'
const baseUrl = '/api/activities/'

let token = null

const setToken = newToken => {
  token = `Bearer ${newToken}`
}




const getAll = (parcId) => {
    const config = {
        headers: { Authorization: token },
      }
    const request = axios.get(origin+baseUrl+parcId, config)
    return request.then(response => response.data)
  }

  const addNew = async (content, aktivnost) => {
    const config = {
        headers: { Authorization: token },
      }
    const object = content
    const response = await axios.post(origin + baseUrl + aktivnost, object, config)
    return response.data
  }


  export default {getAll, setToken, addNew}
