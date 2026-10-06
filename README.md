# Bill Splitter

Split restaurant bills fairly. Upload or photograph a bill, let AI parse it, assign items to people, and get a per-person split with tax and service charge handled correctly — including bills where food and alcohol are taxed differently.

## Features

- AI bill parsing via Claude Vision (images and PDFs, with page picker for multi-page PDFs)
- In-app camera on the Upload screen (falls back to the phone's camera app on non-https)
- Per-category tax and service charge grid (food vs alcohol), with presets:
  Indian GST, GST + alcohol VAT (e.g. Goa), Flat, Compound
- Per-item effective price override for one-off taxes (e.g. cess)
- Bill total reconciliation, tolerant of ₹1 round-off
- Fast manual assignment: tap to toggle people, +/- to weight shares, copy-from-above, split remaining equally, unassigned filter, progress bar, qty/unit hints
- Per-person split with itemised breakdown and discounts
- WhatsApp-friendly summary, PNG export, JSON export
- Test mode — upload a JSON file to skip the AI call
- 6-step wizard: Upload → Review → People → Assign → Split → Output

Only the people list is stored. Bills are never saved on the server.

Set `APP_PASSWORD` to require a shared password (HTTP Basic Auth, any username) on everything except `/api/health`. The Railway deployment has it set; leave it unset locally.

## Tech Stack

- **Frontend:** React (CRA, CSS Modules)
- **Backend:** Node.js + Express
- **AI:** Claude API (`claude-sonnet-5-5`)
- **Storage:** `people.json` in `DATA_DIR` (default `./data`)
- **Hosting:** Railway

## Setup

```bash
npm install
npm install --prefix client
```

Create `server/.env`:

```
ANTHROPIC_API_KEY=your-api-key-here
```

## Run

```bash
npm run dev     # Express on :3001 + React dev server on :3000
```

Production-style (serves the built client from Express on :3001):

```bash
npm run build
npm start
```

## Test Mode

Upload `fixtures/test-bill.json` (or any JSON matching the parse output, including files from **Export JSON**) to skip the AI call.

## Deploy

Deployed on Railway from `main`. Infrastructure (service, volume for `/app/data`, healthcheck) is defined in `.railway/railway.ts`:

```bash
railway config plan     # preview
railway config apply    # apply
```
