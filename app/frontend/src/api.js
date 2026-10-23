// Thin fetch helpers. They only talk to the AeroPrint API; no statistics here.
import { API_BASE } from './config.js'
import { errorText } from './format.js'

async function getJson(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch (err) {
    throw new Error(`Cannot reach the API at ${API_BASE}. Is it running? (${err.message})`)
  }
  if (!res.ok) {
    let body = null
    try {
      body = await res.json()
    } catch {
      // the body was not JSON; fall back to the status code
    }
    throw new Error(errorText(res.status, body))
  }
  return res.json()
}

export const fetchDatasets = () => getJson('/datasets')
export const fetchSpecLimits = () => getJson('/spec-limits')

export function analyzeDataset(name, baselineN) {
  return getJson(`/analyze/${encodeURIComponent(name)}?baseline_n=${baselineN}`)
}

/** specs = {uts_lsl, porosity_usl, dim_lsl, dim_usl}; empty values are not sent. */
export function analyzeUpload(file, baselineN, specs) {
  const q = new URLSearchParams({ baseline_n: String(baselineN) })
  for (const [key, value] of Object.entries(specs)) {
    if (value !== '' && value !== null && value !== undefined) q.set(key, String(value))
  }
  const form = new FormData()
  form.append('file', file)
  return getJson(`/analyze?${q}`, { method: 'POST', body: form })
}
