// First-visit tour: the steps, and a "seen it" flag kept in localStorage.
// Storage can throw (private mode, blocked cookies), so every access is in try/catch and the
// page works without it.

import { README_URL } from './format.js'

const KEY = 'aeroprint-tour-seen'

export const TOUR_STEPS = [
  { title: 'What AeroPrint is for', target: null, text: 'AeroPrint is for the supplier quality engineer who releases builds of 3D-printed titanium brackets, and for the additive manufacturing process engineer who tunes the printer. It decides whether the print process is capable of meeting the allowed values for tensile strength, porosity and dimensional deviation, which builds to release or quarantine, and which print setting, machine or material lot is most likely linked to a problem. Try one of the three example datasets, or upload your own spreadsheet file (CSV).' },
  { title: 'Pick your data', target: 'controls', text: 'Use "Select an example dataset" to pick a built-in example, or "Upload dataset" to analyze your own spreadsheet file (CSV), with one row per coupon and 5 coupons per build.' },
  { title: 'Read the banner', target: 'banner-top', text: 'The banner says whether the process is capable, and whether the numbers can be trusted. A grey number with a warning means the chart is out of control, so do not rely on it.' },
  { title: 'See the calculations', target: 'calc-toggle', text: 'Open "Show the calculations and histograms" in the Process Capable box. It shows each step of the capability index with the real numbers. On each histogram, the solid green line is the process average and the dashed purple lines are the lowest and highest allowed values.' },
  { title: 'Find the red diamonds', target: 'charts', text: 'On the charts, a red diamond is a build that looks different from the baseline builds. The first one marks when the process changed.' },
  { title: 'Look for possible causes', target: 'causes', text: 'This section checks whether machine or material lot is linked to the results. On the plot, parallel lines mean the machine effect is the same in every lot. A small p-value means a difference is likely real, but it does not prove what caused it.' },
  { title: 'Act on each build', target: 'builds', text: 'The table at the bottom says what to do with each build (release or quarantine) and which parameter to investigate first. If the process is not capable, builds show as NOT RELEASED.' },
  { title: 'Read the full documentation', target: null, text: 'The README on GitHub explains every function, input and parameter, walks through the three example datasets with screenshots, and has the codebook for every data file and variable. Open the "GitHub repository" link at the top of the page (it shows the README), or use the link below.', link: { href: README_URL, label: 'Open the README on GitHub' } },
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
