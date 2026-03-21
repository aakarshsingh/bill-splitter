const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const HISTORY_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'history');

// GET /api/load — list saved sessions
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(HISTORY_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(HISTORY_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(HISTORY_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .map((f) => f.name);
    res.json(files);
  } catch (err) {
    console.error('Load list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/load — load a specific session by filename
router.post('/', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }
    // Prevent path traversal
    const safeName = path.basename(filename);
    const filepath = path.join(HISTORY_DIR, safeName);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    res.json(data);
  } catch (err) {
    console.error('Load error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
