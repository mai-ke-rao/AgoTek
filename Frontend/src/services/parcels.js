import axios from 'axios'
const origin = 'http://localhost:3001'
const baseUrl = '/api/parcels'

let token = null

const setToken = newToken => {
  token = `Bearer ${newToken}`
}


const getAll = () => {
    const config = {
        headers: { Authorization: token },
      }
    const request = axios.get(origin+baseUrl, config)
    return request.then(response => response.data)
  }


  export default {getAll, setToken}