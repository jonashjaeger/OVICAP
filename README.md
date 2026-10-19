# OVICAP 1.0 — ZooMS-assisted sheep/goat NISP estimation

**OVICAP estimates numbers of specimens (NISP), not minimum numbers of individuals (MNI).**

An offline-first iPhone-friendly progressive web app that supports:

- Explicit osteological sheep/goat and ambiguous *Ovis/Capra* NISP counts.
- ZooMS-confirmed sheep, goat, other taxa, and inconclusive analyses; no double counting.
- Bayesian Dirichlet/Multinomial posterior-predictive estimation of species-specific NISP, with Monte Carlo 95% prediction intervals.
- Conditional goat proportions among caprines and sensitivity to prior assumptions.
- Rare-taxon detection probabilities, finite-population no-replacement calculation, and sampling effort planning.
- Offline project storage, CSV scenario import/export, CSV estimates, and full JSON backup.

## Getting it onto an iPhone via GitHub Pages

1. Unzip **the contents** of the release, including `index.html`, `app.js`, `engine.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, and `icons/`.
2. Create a **public** GitHub repository called `ovicap` and upload the unzipped files to its root. Keep the icons in the `icons/` subfolder.
3. GitHub repository → **Settings → Pages → Deploy from a branch → main / (root)**.
4. Open `https://YOUR-USERNAME.github.io/ovicap/` in Safari. Tap Share → Add to Home Screen.
5. Open once while online. The offline service worker will cache the application. Use the JSON backup export regularly.

Note: iOS Home Screen apps may store a separate set of local records from regular Safari tabs.

## Reading the form carefully

The **ambiguous NISP** contains every ambiguous fragment counted in the assemblage, **including all the bones selected for ZooMS**. Do not add the analyzed bones again. Specific osteological sheep and goat NISP go in the separate morphological fields.

For the ZooMS tests on the ambiguous specimens, enter all **diagnostic sheep**, **diagnostic goat**, **diagnostic other taxon** (e.g. deer), and **inconclusive** tests. The app subtracts the positive identifications from the ambiguous pool, leaving all inconclusive tests as unresolved.

### Model assumptions

- Under **three-taxon mode**, the unresolved ambiguous material can contain sheep, goat, and other non-caprine taxa. Its diagnostic frequencies are modelled using a symmetric Dirichlet prior with 0.5, 1, or 2 concentration per taxon.
- Under **two-taxon mode**, all still-unresolved specimens are assumed sheep or goat. Previously verified other taxa remain in the known other group.
- Every observation is a fragment/specimen, never an individual animal.
- Morphological species-level assignments are treated as correct, not error-adjusted.
- Inference assumes the ZooMS-tested fragments (conditional on success) are exchangeable with the unresolved pool; this cannot be justified for purposive sampling without additional information.
- Modelled 95% intervals come from **6,000 posterior predictive draws** using a fixed random seed (20261019) for reproducibility. The exact binomial sampler uses beta order-statistic splitting. Intervals include allocation uncertainty and the posterior over proportions, conditional on assumptions. They are not sampling-design-adjusted confidence intervals.
- Data are stored in `localStorage` only (no remote server); back up regularly. CSV exports do not include photos or hidden app data.

The **Karleby preset is a worked illustration, not a published assemblage estimate**. It combines 1,446 reported caprine NISP and nine reported osteologically identifiable sheep with published ZooMS diagnostic counts to construct an example partition; categories cannot be fully verified from the aggregated source alone. ZooMS test specimen selection was primarily targeted towards mandibular teeth and is therefore *not representative random sampling*.

### Detection model

- With underlying goat rate *p*, a successful taxonomic result probability *q*, and *n* attempts, independent-draw detection probability is `1 - (1 - p*q)^n`.
- The finite-population option computes `1 - choose(N-K, n) / choose(N, n)` assuming exactly K goats among N specimens, draws without replacement, and no lab failures.
- The 95% one-sided exact upper bound after zero goats in *n* diagnostic independent tests is `1 - 0.05^(1/n)` under the model assumptions.

### Project import schema

Header columns:

`name,site,period,morphSheep,morphGoat,ambiguous,zooSheep,zooGoat,zooOther,zooFail,strategy,threeTaxa,prior,notes`

`strategy` must be one of `random`, `targeted`, or `unknown`. All NISP counts must be non-negative integers. Model priors must be >0 and ≤25. Any imported row where the ZooMS count exceeds the ambiguous pool will be skipped. Use UTF-8 CSV with commas and RFC 4180 quoted fields.

## Scientific reference

Sjögren, K.-G., Buckley, M., Vretemark, M., & Axelsson, T. (2023). Evaluating caprine remains of the Swedish Funnel Beaker culture through ZooMS. *Archaeological and Anthropological Sciences*, 15, 47. https://doi.org/10.1007/s12520-023-01743-2

OVICAP is not affiliated with or endorsed by the authors. Attribution above is for the motivating probability-of-detection example, **not** for OVICAP's independent Bayesian model.

## Tests

Run `node tests/test-engine.cjs`. Hosted page/browser tests require Chromium or a browser with JavaScript enabled.
