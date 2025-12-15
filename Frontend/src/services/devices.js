import axios from 'axios'

const baseUrl = '/api/TTN'
import { encode as base64_encode} from 'base-64';
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
  const request = axios.get(baseUrl+path, config)
  return request.then(response => response.data)
}

const addNew = async (content) => {
const path = "connector"
 const token = `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`
  const config = {
    headers: { Authorization: token },
  }
const object = content
const response = await axios.post(baseUrl + "/" + path, object, config)
return response.data
}

const getDataPage = (dev_id, page) => {

const path = '/device_data/'
 const token = `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`
const config = {
  headers: { Authorization: token },
}

const request = axios.get(baseUrl+path+dev_id+"/"+page, config)
  return request.then(response => response.data)

}


const sendDownlink = (dev, payload) => {

  const token = `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`

  const config = {
    headers: { Authorization: token },
  }
  

   const b64Payload = base64_encode(payload)

  const object = 
  {
    
    dev_id:  dev.dev_id,
    downlinkPayload: {
      frm_payload: b64Payload,
      f_port: 1,
      priority: 'NORMAL'
    }
  }


  const request = axios.post(baseUrl+"/send-downlink", object, config)
  return request.then(response => response)
}


export default {setToken, getAll, getDataPage, addNew, sendDownlink}