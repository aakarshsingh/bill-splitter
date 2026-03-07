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
│   │   ├── save.js          # POST /api/save — save session to history
│   │   └── load.js          # POST /api/load — load session from JSON upload
│   └── index.js
├── data/
│   ├── people.json          # Master friends list
│   ├── preferences.json     # Learned preferences per person
│   └── history/             # One file per session: place-date.json
├── CLAUDE.md
└── package.json
```

## Screen Flow

```
Upload -> Review -> People -> Instructions -> Assign -> Split -> Output
  1         2        3          4            5        6       7
```

1. **Upload** — Drag & drop or file picker for image/PDF. Preview uploaded file. On confirm -> call `/api/parse`.
2. **Review** — AI-extracted data in editable table (item name, qty, unit price). Extracted tax % and service charge % with manual override. Side-by-side bill preview.
3. **People** — Load from `data/people.json` as selectable chips. Can add new person (saves back). Selected people carry forward.
4. **Instructions** — Free text for natural language assignment hints (e.g. "Split pizza between A, B and C", "A had all the beers"). Multiple instructions allowed. On confirm -> call `/api/assign`.
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
| POST | `/api/save` | Save session to `data/history/establishment-YYYY-MM-DD.json` |
| POST | `/api/load` | Load a history JSON -> repaint full session |

## AI Integration

### Bill Parser (Screen 2) — `POST /api/parse`
- Input: base64 encoded image or PDF
- Claude Vision extracts: line items (name, qty, unit price), tax %, service charge %
- Output: `{ establishment, items: [{ id, name, qty, unitPrice }], tax, serviceCharge }`

### Assignment Engine (Screen 5) — `POST /api/assign`
- Input: parsed items + selected people + free text instructions + preferences history
- Claude NLP interprets instructions, matches items to people, uses preferences as hints
- Output: `{ assignments: { "item-uuid": ["Person A", "Person B"] } }`

## Split Calculation Logic

```
effective_price = unit_price * qty * (1 + tax/100 + serviceCharge/100)
person_share    = effective_price / number of people assigned to that item
person_total    = sum of all person_share values for that person
```

Tax and service charge are distributed proportionally per item — not added as a flat amount at the end.

## Storage Schemas

### data/people.json
```json
[{ "id": "uuid", "name": "Aakarsh" }]
```

### data/preferences.json
```json
{ "Aakarsh": ["gin", "beer", "margherita"] }
```
Updated after each saved session based on assignments.

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

## Build Order

1. Scaffold full project structure + package.json files
2. Screen 1 — Upload (frontend only)
3. Screen 2 — Review (frontend + `/api/parse`)
4. Screen 3 — People (frontend + `/api/people`)
5. Screen 4 — Instructions (frontend only)
6. Screen 5 — Assign (frontend + `/api/assign`)
7. Screen 6 — Split (frontend, pure calculation)
8. Screen 7 — Output + save/load (`/api/save`, `/api/load`)
9. Preference learning (update `preferences.json` on save)
