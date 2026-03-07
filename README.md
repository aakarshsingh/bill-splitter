# Bill Splitter

A local bill splitting app. Upload a restaurant bill image/PDF, let AI parse it, assign items to people, and calculate a fair split with tax and service charge handled correctly.

## Features

- AI-powered bill parsing via Claude Vision
- Food vs alcohol tax handling (Indian GST rules)
- Service charge + tax applied in correct order
- Bill total reconciliation
- 7-step wizard: Upload → Review → People → Instructions → Assign → Split → Output

## Tech Stack

- **Frontend:** React
- **Backend:** Node.js + Express
- **AI:** Claude API (`claude-sonnet-4-20250514`)
- **Storage:** Local JSON files

## Setup

```bash
npm install
cd client && npm install && cd ..
```

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=your-api-key-here
```

## Run

```bash
npm start
```

Opens the React app on `http://localhost:3000` with the Express server on port 3001.
