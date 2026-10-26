# AeroPrint dashboard (React + Vite)

One page that shows what the AeroPrint API ([`../main.py`](../main.py)) computes: whether the titanium-bracket print process is capable, the control charts, the possible-causes analysis for machine and material lot, and a verdict for each build (**QUARANTINE**, **NOT RELEASED** or **RELEASE**) with the print setting to investigate first.

**This front end computes no statistics.** Every number comes from the API's JSON; the code here only formats, scales and draws it. The statistics live in [`../qc.py`](../qc.py). The only arithmetic in the page is rounding for display, counting the API's verdict words, and subtracting two displayed means in one sentence of the Possible Causes section.

The full documentation (how to use each box and chart, the method, the API, the datasets) is the **[root README](../../README.md)**; a click-by-click demo is [`../../demo/README.md`](../../demo/README.md).

Live dashboard: <https://connect.systems-apps.com/content/a5702adb-d4c3-4cbc-8856-737753cfd9d2/>

## Run it

Start the API first (see [the root README](../../README.md#3-run-it-yourself)):

```bash
bash app/testme.sh            # http://localhost:8000 (run from the repo root)
```

Then, in a second terminal:

```powershell
cd app\frontend
npm install
npm run dev                   # http://localhost:5173
```

Use *Select an example dataset*, or *Upload dataset* for your own CSV (5 required columns, optional print settings, optional `machine_id` and `material_lot`, extra columns ignored: see [`../../docs/csv-format.md`](../../docs/csv-format.md)). The *How should my file be formatted?* button under *Upload dataset* opens a window that links two template CSVs, which live in `public/` and are copies of [`../../data/template/`](../../data/template/).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | development server at <http://localhost:5173> with hot reload |
| `npm run build` | static site in `dist/` |
| `npm run preview` | serves the built `dist/` locally |
| `npm test` | runs the tests with vitest (172 tests in 7 files) |

## Where the API address comes from

[`src/config.js`](src/config.js) is the only place the API address lives:

```js
export const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '')
```

Without `VITE_API_BASE` the page calls `http://localhost:8000`. To point a build at another API:

```powershell
$env:VITE_API_BASE = "https://<your-api-url>"; npm run build
```

```bash
VITE_API_BASE=https://<your-api-url> npm run build
```

## How the static deploy works

The build uses relative asset paths (`base: './'` in `vite.config.js`), so the built `dist/` works under any sub-path, such as a Posit Connect content address. The GitHub Actions workflow [`.github/workflows/deploy-react-static.yml`](../../.github/workflows/deploy-react-static.yml) runs `npm ci` and `npm run build` with `VITE_API_BASE` set to the deployed API, then publishes `dist/` to Posit Connect. It runs on each push to `main` that touches `src/`, `public/`, `index.html`, `package.json`, `package-lock.json` or `vite.config.*`. The Connect address and API key are repository secrets and are never written in a file.

## Module map (`src/`)

| Module | Job |
|---|---|
| `main.jsx` | starts React and loads `styles.css` |
| `App.jsx` | the page: Dataset and Test Parameters boxes, the Process Capable banner, Summary, Control Charts with the Baseline builds box, Builds table, rules legend |
| `config.js` | the API address (above) |
| `api.js` | calls `/datasets`, `/spec-limits`, `/analyze/{dataset}` and `POST /analyze` |
| `ControlChart.jsx` | one control chart (X-bar, R, I or MR) as inline SVG, with hover or tap boxes |
| `Calculations.jsx`, `calc.js` | the "Show the calculations and histograms" toggle; `calc.js` picks the words and rounded numbers |
| `Histogram.jsx` | a histogram of baseline coupons as SVG |
| `Causes.jsx`, `causes.js` | the Possible Causes section and its pure helpers (statuses, sentences, ANOVA rows, plot model) |
| `InteractionPlot.jsx` | the machine-by-lot interaction plot as SVG |
| `CsvHelp.jsx`, `Dialog.jsx` | the file-format window and the accessible popup it uses |
| `Tour.jsx`, `tour.js` | the guided tour (8 steps) and its "seen it" flag in `localStorage` |
| `format.js` | number and time formatting, the four allowed-value boxes and their checks, the Baseline builds rules, plain hints for upload errors, the GitHub links |
| `plain.js` | plain words for rules, notes, chart titles and column meanings |
| `labels.js` | all visible page words in one place |
| `scale.js` | axis and label geometry (numbers to pixels) |
| `styles.css` | the look of the page |
| `causes.fixture.js` | test-only sample `factors` blocks (not used by the app) |

## Tests

```bash
npm test
```

Test files sit next to the modules they check: `calc.test.js`, `causes.test.js`, `format.test.js`, `plain.test.js`, `plainwords.test.js` (checks the wording of every visible sentence), `scale.test.js` and `tour.test.js`. They test formatting, wording, axis scaling, input checks and the tour steps. The statistics are tested in Python (`../../tests/`).
