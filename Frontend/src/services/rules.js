import axios from 'axios'
import { encode as base64_encode } from 'base-64'
const origin = import.meta.env.VITE_IOT_URL
const baseUrl = '/api/rules'

// API comparator → what the UI shows
export const COMPARATOR_SYMBOL = { lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=', neq: '≠' }

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`,
  },
})

const getAll = () => {
  const request = axios.get(origin + baseUrl, authConfig())
  return request.then(response => response.data)
}

const getOne = (id) => {
  const request = axios.get(origin + baseUrl + '/' + id, authConfig())
  return request.then(response => response.data)
}

const create = async (rule) => {
  const response = await axios.post(origin + baseUrl, rule, authConfig())
  return response.data
}

const patch = async (id, changes) => {
  const response = await axios.patch(origin + baseUrl + '/' + id, changes, authConfig())
  return response.data
}

const remove = async (id) => {
  await axios.delete(origin + baseUrl + '/' + id, authConfig())
}

// No devId → disables every enabled rule the user has.
const killSwitch = async (devId) => {
  const response = await axios.post(origin + baseUrl + '/kill-switch', devId ? { devId } : {}, authConfig())
  return response.data
}

const getAudit = (id, page) => {
  const request = axios.get(origin + baseUrl + '/' + id + '/audit/' + page, authConfig())
  return request.then(response => response.data)
}

// Same shape devices.sendDownlink builds from the "send downlink" form, so a
// rule's action is typed exactly like a manual downlink.
const buildDownlinkPayload = (text) => ({
  frm_payload: base64_encode(text),
  f_port: 1,
  priority: 'NORMAL',
})

// Turns an axios failure into something a notification can show. Zod errors
// arrive as { error: { formErrors, fieldErrors } }, everything else as a string.
const errorMessage = (e) => {
  const err = e.response?.data?.error
  if (!err) return e.message
  if (typeof err === 'string') {
    const devIds = e.response?.data?.devIds
    return devIds ? `${err}` : err
  }
  const fields = Object.entries(err.fieldErrors ?? {}).map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
  return [...(err.formErrors ?? []), ...fields].join(' | ') || 'Neispravan zahtev'
}

export default { getAll, getOne, create, patch, remove, killSwitch, getAudit, buildDownlinkPayload, errorMessage }
