const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '../../data/people.json');

function readPeople() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writePeople(people) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(people, null, 2));
}

router.get('/', (req, res) => {
  try {
    res.json(readPeople());
  } catch (err) {
    console.error('Error reading people:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const people = readPeople();
    const newPerson = { id: uuidv4(), name: name.trim() };
    people.push(newPerson);
    writePeople(people);
    res.json(newPerson);
  } catch (err) {
    console.error('Error adding person:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
