const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const HISTORY_DIR = path.join(__dirname, '../../data/history');
const PREFS_FILE = path.join(__dirname, '../../data/preferences.json');

// Only learn these known keywords — keeps preferences clean and useful
const MEAT_KEYWORDS = ['chicken', 'mutton', 'lamb', 'pork', 'beef', 'seafood', 'fish', 'prawn', 'shrimp', 'crab', 'lobster', 'squid'];
const DRINK_KEYWORDS = ['beer', 'wine', 'whisky', 'whiskey', 'vodka', 'gin', 'rum', 'cocktail', 'cocktails', 'champagne', 'sake', 'tequila'];

// Map variants to canonical preference values
const MEAT_MAP = {
  chicken: 'chicken', mutton: 'mutton', lamb: 'mutton',
  pork: 'pork', beef: 'beef',
  seafood: 'seafood', fish: 'seafood', prawn: 'seafood', shrimp: 'seafood',
  crab: 'seafood', lobster: 'seafood', squid: 'seafood',
};
const DRINK_MAP = {
  beer: 'beer', wine: 'wine', whisky: 'whisky', whiskey: 'whisky',
  vodka: 'vodka', gin: 'gin', rum: 'rum',
  cocktail: 'cocktails', cocktails: 'cocktails',
  champagne: 'wine', sake: 'sake', tequila: 'tequila',
};

function extractKeywords(itemName) {
  const lower = itemName.toLowerCase();
  const meats = new Set();
  const drinks = new Set();
  for (const [keyword, canonical] of Object.entries(MEAT_MAP)) {
    if (lower.includes(keyword)) meats.add(canonical);
  }
  for (const [keyword, canonical] of Object.entries(DRINK_MAP)) {
    if (lower.includes(keyword)) drinks.add(canonical);
  }
  return { meats: [...meats], drinks: [...drinks] };
}

function learnPreferences(session) {
  const { items, assignments, people } = session;
  if (!items || !assignments || !people) return;

  let prefs;
  try {
    prefs = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8'));
  } catch {
    prefs = {};
  }

  const itemsById = {};
  for (const item of items) itemsById[item.id] = item;

  for (const person of people) {
    const name = person.name;
    if (!prefs[name]) continue; // Only learn for people already in preferences

    const current = prefs[name];
    const newMeats = new Set(current.meats || []);
    const newDrinks = new Set(current.drinks || []);

    for (const [itemId, personParts] of Object.entries(assignments)) {
      const parts = personParts[name] || 0;
      if (parts <= 0) continue;

      const item = itemsById[itemId];
      if (!item) continue;

      // Skip items shared equally among everyone — too generic to learn from
      const totalAssigned = Object.values(personParts).filter((v) => v > 0).length;
      if (totalAssigned === people.length) continue;

      const kw = extractKeywords(item.name);

      if (item.category === 'alcohol') {
        for (const d of kw.drinks) newDrinks.add(d);
      } else if (current.diet !== 'veg') {
        // Only learn meat prefs for non-veg people
        for (const m of kw.meats) newMeats.add(m);
      }
    }

    current.meats = [...newMeats];
    current.drinks = [...newDrinks];
  }

  fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
}

router.post('/', (req, res) => {
  try {
    const { session } = req.body;
    if (!session) {
      return res.status(400).json({ error: 'session data is required' });
    }

    if (!fs.existsSync(HISTORY_DIR)) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }

    const establishment = (session.establishment || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const date = new Date().toISOString().slice(0, 10);
    let filename = `${establishment}-${date}.json`;

    let filepath = path.join(HISTORY_DIR, filename);
    let counter = 1;
    while (fs.existsSync(filepath)) {
      filename = `${establishment}-${date}-${counter}.json`;
      filepath = path.join(HISTORY_DIR, filename);
      counter++;
    }

    fs.writeFileSync(filepath, JSON.stringify(session, null, 2));

    // Learn preferences from this session's assignments
    try {
      learnPreferences(session);
    } catch (err) {
      console.error('Preference learning error (non-fatal):', err);
    }

    res.json({ filename, path: filepath });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
