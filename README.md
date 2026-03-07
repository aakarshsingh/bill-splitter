# Bill Splitter

A local bill splitting app. Upload a restaurant bill image/PDF, let AI parse it, assign items to people, and calculate a fair split with tax and service charge handled correctly.

## Features

- AI-powered bill parsing via Claude Vision
- AI-suggested item assignments based on preferences and instructions
- Selectable tax/SC formula presets (Indian GST, Flat, SC-then-Tax, Tax-then-SC)
- Bill date extraction from receipt (falls back to current date)
- Bill total reconciliation
- Structured user preferences (diet, meats, drinks) with automatic learning across sessions
- Preference-aware auto-generated instructions and bill-aware quick-add examples
- `@` autocomplete for people, `#` autocomplete for items in instructions
- +/- proportional share buttons with sticky header/column for large bills
- Assignments persist when navigating back; explicit "Re-suggest with AI" button
- Per-person split with itemised breakdown
- WhatsApp-friendly summary copy
- Export detailed breakdown as PNG image
- Save/load past sessions (re-saving overwrites the original file)
- Test mode — upload a JSON file to skip AI calls during development
- 7-step wizard: Upload → Review → People → Instructions → Assign → Split → Output

## Tech Stack

- **Frontend:** React (CSS Modules, no frameworks)
- **Backend:** Node.js + Express
- **AI:** Claude API (`claude-sonnet-4-20250514`) for bill parsing and assignment suggestions
- **Storage:** Local JSON files (`data/` directory)

## Setup

```bash
npm install
cd client && npm install && cd ..
```

Create a `.env` file in `server/`:

```
ANTHROPIC_API_KEY=your-api-key-here
```

## Run

```bash
npm start
```

Opens the React app on `http://localhost:3000` with the Express server on port 3001.

## Test Mode

Upload `data/test-bill.json` (or any `.json` matching the parse output schema) to skip all AI API calls. Includes sample items and pre-built assignments.
