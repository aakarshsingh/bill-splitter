# Conventions

- **Tone:** Be extremely concise. Lead with answers, not reasoning.

## Project Topography

- Standalone full-stack app, two npm packages: root (Express server + scripts) and `client/` (CRA React).
- `server/index.js` mounts `server/routes/*.js` (one Express Router per `/api/<name>`: `parse`, `people`), `/api/health`, and serves `client/build`.
- `client/src/App.jsx` owns `sessionData` and the 6-step stepper; `client/src/screens/<Screen>.jsx` + `<Screen>.module.css`, one per step.
- Shared client modules: `calcLib.js` (rates + split math), `imageUtils.js` (downscale, camera frame), `components/PriceInput.jsx`.
- `data/` — gitignored; holds only `people.json` (`DATA_DIR`, Railway volume at `/app/data`). Bills are never persisted.
- `fixtures/test-bill.json` — tracked sample for test mode.
- `.railway/railway.ts` — Railway IaC (service, volume, healthcheck). Only TypeScript file in the repo.
- CI: `.github/workflows/` — Claude Code PR review + `@claude` mention bot. No build/test CI.
- `CLAUDE.md` is the authoritative product spec (screens, API, schemas, formulas).

## Naming Conventions

- Screens/components: PascalCase `.jsx`; CSS Modules `<Name>.module.css` imported as `styles`.
- Routes: lowercase file = API path segment (`routes/people.js` → `/api/people`).
- Utilities: camelCase (`calcLib.js`, `calcItemBreakdown`).
- Rate preset IDs: kebab-case (`indian-gst`, `alcohol-vat`, `flat`, `compound`).
- Rate keys: `sc`, `tax`, `scTax` per category (`food`, `alcohol`).

## Patterns & Idioms

- Plain JavaScript only — no TypeScript (except `.railway/railway.ts`), no CSS frameworks.
- Server: CommonJS (`require`), `express.Router()`, sync `fs` read/write of JSON, `try/catch` → `res.status(500).json({ error: err.message })`; 400 for missing input.
- Client: ESM, function components + hooks, raw `fetch('/api/...')` (CRA proxy to :3001), check `r.ok` and throw.
- Screen contract: receive `initial*` props from `sessionData`, call `onConfirm(data)` to save + advance. Back-nav must restore state without re-calling APIs.
- Money: integers in paise; format only at display. Rupee inputs use `PriceInput` (never `value={formatPrice(x)}` on a controlled number input — it mangles typing).
- Rates: `reviewData.rates` replaces old `tax`/`serviceCharge`/`formulaMode`; `legacyToRates` converts old JSON. `item.effectiveOverride` (paise) bypasses rates.
- Assignments: `{ itemId: { personName: parts } }` (integer parts); fractions computed at render. Guard `prev[itemId] || {}` — items can be added after assigning.
- IDs via `uuid` (v4) on server.
- AI: `@anthropic-ai/sdk`, model `claude-sonnet-5-5` (architect's choice). Structured output via `output_config.format` JSON schema (nested objects need `additionalProperties: false` + `required`; no numeric constraints); read text block by `type`; handle `max_tokens` / `refusal`.
- Test mode: `.json` upload bypasses `/api/parse`.

## Tooling & Commands

- Node ≥18, npm. Install: `npm install && npm install --prefix client`.
- Dev: `npm run dev` (server :3001 + CRA :3000). `npm start` = server only (serves `client/build`).
- Build: `npm run build` (installs client deps, `CI=false` CRA build). Strict check: `cd client && CI=true npx react-scripts build`.
- Env: `server/.env` with `ANTHROPIC_API_KEY` (template `.env.example` at root). Railway holds the prod key.
- Railway: `railway config plan` / `railway config apply` (project `as-bill-splitter`, service `bill-splitter`, env `production`). Apply only with architect approval.
- No test runner, linter, or formatter configured.
- **Verification:** strict build passes + manual run through all 6 screens using `fixtures/test-bill.json` (no API cost). Calc changes: compare `calcTotal` against known receipts (Goa ₹13,239.75 with alcohol-vat; Bengaluru ₹4,871.25 with indian-gst).

## Field Notes

- Receipt patterns: Karnataka — food GST 5%, alcohol tax-inclusive (0). Goa — food GST 5%, alcohol VAT 22% on base. Receipts round CGST/SGST halves separately, so expect ±₹1 round-off.
- Claude rejects base64 images > 5MB; `shrinkImage` downscales before parse.
- Live camera (`getUserMedia`) needs https/localhost; LAN http falls back to `<input capture>`.
- `express.json` limit 50mb (base64 bill uploads).
- Large screens (Output, Split ~15KB) hold most logic inline.
