// Thin fetch helpers. They only talk to the AeroPrint analysis service (API); no statistics here.
import { API_BASE } from './config.js'
import { analysisQuery, errorText } from './format.js'

async function getJson(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch (err) {
    throw new Error(`Cannot reach the analysis service at ${API_BASE}. Is it running? (${err.message})`)
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

/** specs = {uts_lsl, porosity_usl, dim_lsl, dim_usl}; blank values are not sent. */
export function analyzeDataset(name, baselineN, specs) {
  return getJson(`/analyze/${encodeURIComponent(name)}?${analysisQuery(baselineN, specs)}`)
}

export function analyzeUpload(file, baselineN, specs) {
  const form = new FormData()
  form.append('file', file)
  return getJson(`/analyze?${analysisQuery(baselineN, specs)}`, { method: 'POST', body: form })
}
