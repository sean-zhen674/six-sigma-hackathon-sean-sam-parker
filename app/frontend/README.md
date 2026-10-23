# AeroPrint dashboard (React + Vite)

One page that shows what the AeroPrint API (`app/main.py`) computes: whether the titanium-bracket
print process is capable, the X-bar/R and I-MR control charts, and a RELEASE / QUARANTINE
decision for each build with the print parameter to investigate first.

**This front end computes no statistics.** Every number comes from the API's JSON; the code here only
formats, scales and draws it. The statistics live in `app/qc.py`.

## Run it

Start the API first (see [`../README.md`](../README.md)):

```bash
bash app/testme.sh            # http://localhost:8000
```

Then, in a second terminal:

```bash
cd app/frontend
npm install
npm run dev                   # http://localhost:5173
```

Use *Select an example dataset*, or *Upload dataset* for your own CSV (5 required columns, optional print parameters, extra columns ignored: see [`../../docs/csv-format.md`](../../docs/csv-format.md); the *How should my file be formatted?* button under *Upload dataset* opens a popup that links two template CSVs, which live in `public/` and are copies of `../../data/template/`).
A walkthrough of all three datasets, with screenshots, is in [`../../demo/README.md`](../../demo/README.md).

## Files

| File | Job |
|---|---|
| `src/config.js` | the one place the API address lives (`VITE_API_BASE`, default `http://localhost:8000`) |
| `src/api.js` | calls `/datasets`, `/spec-limits`, `/analyze` |
| `src/App.jsx` | the page: controls, banner, charts, build table, rule legend |
| `src/ControlChart.jsx` | one control chart drawn as inline SVG |
| `src/format.js`, `src/plain.js`, `src/labels.js`, `src/scale.js` | number formatting, plain-words text (rule sentences, notes, labels) and axis scaling (no statistics), with tests |

## Test and build

```bash
npm test                      # vitest: formatting and scaling helpers
npm run build                 # static site in dist/
VITE_API_BASE=https://<your-api-url> npm run build   # point the build at the deployed API
```

The build uses relative asset paths (`base: './'`) so it works under a sub-path on Posit Connect.
