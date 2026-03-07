# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A full-stack local bill splitting app for personal use.
Upload a bill image/PDF -> AI parses it -> assign items to people -> calculate fair split with tax and service charge baked in proportionally.

Single user. No auth. No cloud. Runs locally.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React |
| Backend | Node.js + Express |
| AI | Claude API (Vision + NLP) — use `claude-sonnet-4-20250514` |
| Storage | Local JSON files via `fs` module |
| Run | `npm start` from root |

## Project Structure

```
bill-splitter/
├── client/                  # React frontend
│   ├── src/
│   │   ├── screens/         # One component per screen
│   │   ├── components/      # Shared UI components
│   │   └── App.jsx
│   └── package.json
├── server/                  # Express backend
│   ├── routes/
│   │   ├── parse.js         # POST /api/parse — bill image -> JSON
│   │   ├── assign.js        # POST /api/assign — items + instructions -> assignments
│   │   ├── people.js        # GET/POST /api/people
│   │   ├── preferences.js   # GET/POST /api/preferences
│   │   ├── save.js          # POST /api/save — save session to history
│   │   └── load.js          # POST /api/load — load session from JSON upload
│   └── index.js
├── data/
│   ├── people.json          # Master friends list
│   ├── preferences.json     # Learned preferences per person
│   ├── test-bill.json       # Sample parsed bill for test mode
│   └── history/             # One file per session: place-date.json
├── CLAUDE.md
└── package.json
```

## Navigation

App uses a stepper nav bar at the top. Users can click back to any completed step without losing data. Session state is held in `App.jsx`'s `sessionData` object and passed as `initialData`/`initialFile` props so screens restore their state on revisit (no re-fetching APIs).

Key props pattern: each screen receives its initial state from `sessionData` and calls `onConfirm(data)` to save back and advance.

## Test Mode

Upload a `.json` file instead of an image/PDF to skip all AI API calls. The Review screen reads the JSON directly as parsed bill data. Use `data/test-bill.json` as a sample (8 items, mix of food and alcohol, 5% tax, 10% SC). Test JSON must match the `/api/parse` output schema.

## Screen Flow

```
Upload -> Review -> People -> Instructions -> Assign -> Split -> Output
  1         2        3          4            5        6       7
```

1. **Upload** — Drag & drop or file picker for image/PDF. Preview uploaded file. On confirm -> advance to Review. Accepts `initialFile`/`initialPreviewUrl` to restore on back-nav.
2. **Review** — Calls `/api/parse` on first visit (skips if `initialData` present from back-nav or JSON test file). Editable table with item name, type (food/alcohol), qty, unit price, SC amount, tax amount, effective price. Tax/GST % and SC % with manual override. Side-by-side bill preview. Bill total reconciliation with match/mismatch indicator.
3. **People** — Load from `data/people.json` as selectable chips (sorted alphabetically). Select All / Select None buttons. Can add new person (saves back, auto-selected). Selected chips show a ✎ edit icon that opens a **modal dialog** for structured preferences: diet (veg/non-veg), meats (chicken, mutton, pork, beef, seafood — only for non-veg), drinks (beer, wine, whisky, vodka, gin, rum, cocktails, non-drinker). Modal shows live summary and saves to server immediately. Passes `selectedPeople` + `preferences` forward.
4. **Instructions** — Auto-generates instructions from preferences on first visit (e.g. "X is vegetarian", "Y doesn't eat pork or beef", "Z doesn't drink", "W drinks beer and wine"). Shows people tags and preference summary as reference. Users can edit/remove auto-generated instructions, add free text, or use quick-add example buttons (preference-aware — only shows relevant examples based on actual preferences). **@ autocomplete**: type `@` in the textarea to get a dropdown of matching people names; navigate with arrow keys, select with Enter/Tab, dismiss with Escape. Clear all button to start fresh. On back-nav, restores user's edited list (no re-generation).
5. **Assign** — AI-suggested assignments as checkboxes (item -> people). Full manual override. Items can be shared among multiple people.
6. **Split** — Per-person totals with itemised breakdown. Shows effective price per item (base + tax + SC).
7. **Output** — Final per-person summary. WhatsApp-friendly text copy. Save session -> `data/history/`. Load past session from JSON upload.

## API Routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/parse` | Bill image/PDF -> structured JSON via Claude Vision |
| POST | `/api/assign` | Items + instructions + preferences -> suggested assignments via Claude NLP |
| GET | `/api/people` | Load master friends list |
| POST | `/api/people` | Add new person to master list |
| GET | `/api/preferences` | Load all structured preferences |
| POST | `/api/preferences` | Update one person's preferences `{ name, prefs }` |
| POST | `/api/save` | Save session to `data/history/establishment-YYYY-MM-DD.json` |
| POST | `/api/load` | Load a history JSON -> repaint full session |

## AI Integration

### Bill Parser (Screen 2) — `POST /api/parse`
- Input: base64 encoded image or PDF
- Claude Vision extracts: line items (name, qty, unit price, food/alcohol category), tax %, service charge %, bill total
- Output: `{ establishment, items: [{ id, name, qty, unitPrice, category }], tax, serviceCharge, billTotal }`

### Assignment Engine (Screen 5) — `POST /api/assign`
- Input: parsed items + selected people + free text instructions + preferences history
- Claude NLP interprets instructions, matches items to people, uses preferences as hints
- Output: `{ assignments: { "item-uuid": ["Person A", "Person B"] } }`

## Split Calculation Logic

Each item has a category: `food` or `alcohol`. In India, GST applies to food but NOT to alcohol. SC applies to everything. SC is added first, then tax.

```
Food:    effective = unitPrice * qty * (1 + SC/100) * (1 + tax/100)
Alcohol: effective = unitPrice * qty * (1 + SC/100 * (1 + tax/100))
```

For alcohol, tax is only applied to the SC portion (service is taxable), not to the alcohol cost itself.

```
person_share = effective / number of people assigned to that item
person_total = sum of all person_share values for that person
```

The Review screen shows a bill total reconciliation — the calculated total should match the receipt total.

## Storage Schemas

### data/people.json
```json
[{ "id": "uuid", "name": "Aakarsh" }]
```

### data/preferences.json
```json
{
  "Aakarsh": {
    "diet": "non-veg",
    "meats": ["chicken", "mutton"],
    "drinks": ["beer", "whisky"]
  }
}
```
Structured preferences: `diet` (veg/non-veg), `meats` (array, only for non-veg), `drinks` (array, empty = non-drinker). Edited in Screen 3 and auto-updated by Screen 7 on save (learning system — assignments inform future preferences).

### data/history/establishment-YYYY-MM-DD.json
Must contain everything to fully repaint the session (all 7 screens): establishment, date, people, instructions, items, tax, serviceCharge, assignments, splits.

## Conventions

- `uuid` package for all IDs
- All monetary values stored as numbers (paise/cents), displayed formatted
- Dates in `YYYY-MM-DD` format
- History filename: `establishment-name-YYYY-MM-DD.json` (lowercase, hyphens)
- React screens in `client/src/screens/`, one file per screen
- No TypeScript — plain JavaScript throughout
- No CSS frameworks — plain CSS modules per component
- `data/` contents are gitignored

## Current Status

- [x] Project scaffold + package.json files
- [x] Stepper navigation with back-nav support
- [x] Screen 1 — Upload (drag & drop, file picker, preview, JSON test mode)
- [x] Screen 2 — Review (AI parse, editable table, food/alcohol, tax/SC, bill reconciliation)
- [x] Screen 3 — People (selectable chips, add person, structured preferences editor)
- [x] Screen 4 — Instructions (free text hints, preference-aware examples)
- [ ] Screen 5 — Assign (frontend + `/api/assign`)
- [ ] Screen 6 — Split (frontend, pure calculation)
- [ ] Screen 7 — Output + save/load + preference learning (`/api/save`, `/api/load`)
