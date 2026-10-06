# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A full-stack bill splitting app for personal use.
Upload or photograph a bill -> AI parses it -> assign items to people -> calculate a fair split with tax and service charge baked in proportionally.

Single user. Runs locally or on Railway. Only the people list is persisted — bills are never saved.
When `APP_PASSWORD` is set (Railway), every route except `/api/health` requires it via HTTP Basic Auth (`server/auth.js`; any username). Unset locally = no password.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React (Create React App) |
| Backend | Node.js + Express |
| AI | Claude API (Vision) — `claude-sonnet-5-5` |
| Storage | `people.json` in `DATA_DIR` via `fs` |
| Hosting | Railway (`.railway/railway.ts`, volume at `/app/data`) |

## Project Structure

```
bill-splitter/
├── client/                  # React frontend
│   ├── src/
│   │   ├── screens/         # One component per screen
│   │   ├── components/      # Shared UI components (PriceInput)
│   │   ├── calcLib.js       # Rates + split math
│   │   ├── imageUtils.js    # Downscale photos / capture camera frames
│   │   └── App.jsx
│   └── package.json
├── server/
│   ├── routes/
│   │   ├── parse.js         # POST /api/parse — bill image/PDF -> JSON
│   │   └── people.js        # GET/POST /api/people
│   ├── auth.js              # APP_PASSWORD gate (HTTP Basic)
│   └── index.js             # Also serves client/build and /api/health
├── fixtures/
│   └── test-bill.json       # Sample parsed bill for test mode
├── data/                    # gitignored — people.json only
├── .railway/railway.ts      # Railway infrastructure as code
└── package.json
```

## Navigation

Stepper nav bar at the top. Users can click back to any completed step without losing data. Session state lives in `App.jsx`'s `sessionData` and is passed down as `initial*` props so screens restore on revisit without re-calling APIs. Each screen calls `onConfirm(data)` to save back and advance.

## Test Mode

Upload a `.json` file instead of an image/PDF to skip the AI call. Review reads it directly as parsed bill data. Must match the `/api/parse` output schema. `fixtures/test-bill.json` is a sample (8 items, food + alcohol, Indian GST rates, 10% SC). Older JSON with `tax`/`serviceCharge`/`formulaMode` is converted to `rates` on load. Output's **Export JSON** produces a file that can be re-uploaded this way.

## Screen Flow

```
Upload -> Review -> People -> Assign -> Split -> Output
  1         2        3         4        5        6
```

1. **Upload** — Drag & drop / file picker (JPG, PNG, WebP, PDF, JSON) or **Take a photo**. The camera opens a live in-app viewfinder (`getUserMedia`, rear camera) in secure contexts (https/localhost); otherwise falls back to the OS camera via `<input capture>`. Multi-page PDFs get a page picker.
2. **Review** — Calls `/api/parse` on first visit (skipped for JSON or back-nav). Large photos are downscaled first (≤2400px, ≤3.5MB) to stay under Claude's 5MB image limit. Editable table: name, type (food/alcohol), qty, unit price, SC, tax, effective. **Rate grid** (food/alcohol × SC% / Tax% / Tax-on-SC%) with preset buttons. **✎ per item** overrides the effective price for odd taxes (e.g. cess); ↺ removes it. Bill total reconciliation — within ₹1 shows as round-off.
3. **People** — Chips from `/api/people`, sorted alphabetically. Select All / None. Add a person (saved, auto-selected).
4. **Assign** — Items as rows, people as columns, sticky header/first column/footer. Tap a count to toggle a person in/out; +/- to weight parts. Row actions: **↑ same as above**, **= split equally**, **x clear**. Bulk: **split remaining equally**, split all, clear all. Progress bar + "unassigned only" filter. Items with qty > 1 show a parts-vs-units hint. Must assign every item to continue.
5. **Split** — Pure frontend. Per-person cards (highest first), expandable itemised breakdown, share bar. Overview shows food/alcohol tax rates. Discount by %, flat, or final amount (largest-remainder allocation).
6. **Output** — Summary table, **Copy for WhatsApp**, **Export as Image** (html2canvas, 2x PNG), **Export JSON**, **Start Over**. Collapsible detailed breakdown.

## API Routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/parse` | Bill image/PDF (base64) -> structured JSON via Claude Vision |
| GET | `/api/people` | Load people list |
| POST | `/api/people` | Add a person `{ name }` |
| GET | `/api/health` | Railway healthcheck |

### Bill Parser — `POST /api/parse`
- Input: `{ fileData (base64), mimeType, pageNumber? }`
- Beta endpoint with server-side refusal fallback (`fallbacks: 'default'`, beta `server-side-fallback-2026-07-01`).
- Structured output (`output_config.format` JSON schema). Output: `{ establishment, date, items: [{ id, name, qty, unitPrice, category }], rates, billTotal }`
- Prompt rules that matter: amount column is often the **line total** (unitPrice = total ÷ qty); drop zero-priced parent lines; infer which category a tax covers from **amounts**, not labels; CGST + SGST are summed; liquor VAT is alcohol tax.
- `date` is YYYY-MM-DD or `null` (falls back to today downstream).

## Split Calculation Logic

All math lives in `client/src/calcLib.js` — shared by Review, Assign, and Split.

```
rates = { food: { sc, tax, scTax }, alcohol: { sc, tax, scTax } }   // percentages
effective = base + base×sc + base×tax + (base×sc)×scTax              // base = unitPrice × qty
effective = item.effectiveOverride                                   // when set (paise)
person_share = effective × (person_parts / total_parts_for_item)
```

Presets fill the grid from the food SC%/tax% (tax-on-SC is zeroed when SC is 0):

| Preset | Food (SC / Tax / Tax on SC) | Alcohol (SC / Tax / Tax on SC) | Example |
|---|---|---|---|
| `indian-gst` | S / T / T | S / 0 / T | Bengaluru — liquor price includes tax |
| `alcohol-vat` | S / T / T | S / 22 / T | Goa — VAT on liquor |
| `flat` | S / T / 0 | S / T / 0 | |
| `compound` | S / T / T | S / T / T | Covers old sc-then-tax and tax-then-sc (same total) |

Assignments are stored as `{ itemId: { personName: parts } }` (integer parts); fractions are computed at render time.

## Storage

### data/people.json (`DATA_DIR`, default `./data`)
```json
[{ "id": "uuid", "name": "Aakarsh" }]
```
Created empty on server start if missing. On Railway, `DATA_DIR=/app/data` is a mounted volume.

## Deployment (Railway)

- Project `as-bill-splitter`, service `bill-splitter`, auto-deploys from GitHub `main`.
- Railpack builds with root `npm run build` (installs + builds `client/`) and runs `npm start`.
- `.railway/railway.ts` is the source of truth for the service, volume, and healthcheck. After editing: `railway config plan`, then `railway config apply`. Never commit secrets — variables use `preserve()`.
- `ANTHROPIC_API_KEY` and `APP_PASSWORD` are Railway variables; locally the key goes in `server/.env` (leave `APP_PASSWORD` unset).

## Conventions

- `uuid` for server IDs; `crypto.randomUUID()` for client-added items
- Money is integer paise everywhere; format only at display. Use `PriceInput` for rupee inputs
- Dates in `YYYY-MM-DD`
- React screens in `client/src/screens/`, one file + `.module.css` per screen
- No TypeScript in the app (`.railway/railway.ts` is the only exception) — plain JavaScript
- No CSS frameworks — CSS modules
- `data/` is gitignored; sample data lives in `fixtures/`
