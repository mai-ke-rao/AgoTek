import axios from 'axios'
const origin = 'http://localhost:3001'
const baseUrl = '/api/TTN'

let token = null

const setToken = newToken => {
  token = `Bearer ${newToken}`
  console.log("token is ", token);
}




const getAll = () => {

  const path = '/device_list'

  
  const token = `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`
  const config = {
    headers: { Authorization: token },
  }
  const request = axios.get(origin+baseUrl+path, config)
  return request.then(response => response.data)
}

const addNew = async (content) => {
const path = "connector"
 const token = `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`
  const config = {
    headers: { Authorization: token },
  }
const object = content
const response = await axios.post(origin + baseUrl + "/" + path, object, config)
return response.data
}

const getDataPage = (dev_id, page) => {

const path = '/device_data/'
const config = {
  headers: { Authorization: token },
}

const request = axios.get(origin+baseUrl+path+dev_id+"/"+page, config)
  return request.then(response => response.data)

}


export default {setToken, getAll, getDataPage, addNew}