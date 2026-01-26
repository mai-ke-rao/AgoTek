import axios from 'axios'
const origin = import.meta.env.VITE_API_URL
const baseUrl = '/api/Chirpstack'
import { encode as base64_encode} from 'base-64';
let token = null

const setToken = newToken => {
  token = `Bearer ${newToken}`
  console.log("token is ", token);
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




const sendDownlink = (dev, payload) => {

  const token = `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`

  const config = {
    headers: { Authorization: token },
  }
  

   const b64Payload = base64_encode(payload)

  const object = 
  {
    
    dev_eui:  dev.dev_eui,
    downlinkPayload: b64Payload
    
  }


  const request = axios.post(origin+baseUrl+"/send-downlink", object, config)
  return request.then(response => response)
}


export default {setToken, addNew, sendDownlink}