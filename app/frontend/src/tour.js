// First-visit tour: the steps, and a "seen it" flag kept in localStorage.
// Storage can throw (private mode, blocked cookies), so every access is in try/catch and the
// page works without it.

const KEY = 'aeroprint-tour-seen'

export const TOUR_STEPS = [
  { title: 'Pick your data', text: 'Use "Select an example dataset" to pick a built-in example, or "Upload dataset" to analyze your own spreadsheet file (CSV), with one row per coupon and 5 coupons per build.' },
  { title: 'Read the banner', text: 'The banner says whether the process is capable, and whether the numbers can be trusted. A grey number with a warning means the chart is out of control, so do not rely on it.' },
  { title: 'Find the red diamonds', text: 'On the charts, a red diamond is a build that looks different from the baseline builds. The first one marks when the process changed.' },
  { title: 'Act on each build', text: 'The table at the bottom says what to do with each build (release or quarantine) and which parameter to investigate first. If the process is not capable, builds show as NOT RELEASED.' },
]

export function tourSeen(storage) {
  try {
    return (storage ?? window.localStorage).getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(storage) {
  try {
    ;(storage ?? window.localStorage).setItem(KEY, '1')
  } catch {
    // storage is blocked: the tour will show again next visit, which is harmless
  }
}
