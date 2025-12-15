import axios from 'axios'

const baseUrl = '/api/activities/'

let token = null

const setToken = newToken => {
  token = `Bearer ${newToken}`
}




const getAll = (parcId) => {
    const config = {
        headers: { Authorization: token },
      }
    const request = axios.get(baseUrl+parcId, config)
    return request.then(response => response.data)
  }

  const addNew = async (content) => {
    const config = {
        headers: { Authorization: token },
      }
    const object = content
    const response = await axios.post( baseUrl, object, config)
    return response.data
  }

  const deleteOne = async (activityID) => {

 const config = {
        headers: { Authorization: token },
      }
      const resposne = await axios.delete(baseUrl+ activityID, config)
      return resposne
  }


  const updateOne = async (activityID, content) => {
const config = {
        headers: { Authorization: token },
      }

      const object = content
    const response = await axios.put( baseUrl + activityID, object, config)
    return response.data

  }


  export default {getAll, setToken, addNew, deleteOne, updateOne}
