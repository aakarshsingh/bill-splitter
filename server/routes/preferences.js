const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'preferences.json');

function readPreferences() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writePreferences(prefs) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(prefs, null, 2));
}

// GET all preferences
router.get('/', (req, res) => {
  try {
    res.json(readPreferences());
  } catch (err) {
    console.error('Error reading preferences:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST update one person's preferences
router.post('/', (req, res) => {
  try {
    const { name, prefs: personPrefs } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!personPrefs || typeof personPrefs !== 'object') {
      return res.status(400).json({ error: 'prefs object is required' });
    }
    const allPrefs = readPreferences();
    allPrefs[name] = {
      diet: personPrefs.diet || 'non-veg',
      meats: Array.isArray(personPrefs.meats) ? personPrefs.meats : [],
      drinks: Array.isArray(personPrefs.drinks) ? personPrefs.drinks : [],
    };
    writePreferences(allPrefs);
    res.json({ name, prefs: allPrefs[name] });
  } catch (err) {
    console.error('Error updating preferences:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
