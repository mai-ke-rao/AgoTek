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


  const addNew = async (content) => {

    const faketoken = `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`
  const config = {
        headers: { Authorization: faketoken },
      }
      
const object = content
const response = await axios.post(origin + baseUrl, object, config)
return response.data
  }


  export default {getAll, addNew, setToken}