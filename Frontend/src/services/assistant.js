import axios from 'axios'

// The assistant lives in Backend (VITE_API_URL), not the IOT service.
const origin = import.meta.env.VITE_API_URL
const baseUrl = '/api/assistant'

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${JSON.parse(window.localStorage.getItem('loggedFarmAppUser'))?.token}`,
  },
})

// history: [{ role: 'user' | 'assistant', text }] — last turns only.
const ask = async (question, lang, history) => {
  const response = await axios.post(origin + baseUrl + '/ask', { question, lang, history }, authConfig())
  return response.data
}

const confirmProposal = async (id) => {
  const response = await axios.post(`${origin}${baseUrl}/proposals/${id}/confirm`, {}, authConfig())
  return response.data
}

const rejectProposal = async (id) => {
  const response = await axios.post(`${origin}${baseUrl}/proposals/${id}/reject`, {}, authConfig())
  return response.data
}

// Manual citations served by Backend come back as "/manuals/…"; absolute
// links (a publisher URL) pass through. Data citations are in-app routes.
const manualHref = (url) => (url && url.startsWith('/manuals/') ? origin + url : url)

const errorMessage = (e, fallback) => e.response?.data?.message || e.response?.data?.error || fallback

export default { ask, confirmProposal, rejectProposal, manualHref, errorMessage }
