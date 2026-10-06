require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const parseRoute = require('./routes/parse');
const peopleRoute = require('./routes/people');
const { requirePassword } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory and people list exist
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const peopleFile = path.join(dataDir, 'people.json');
if (!fs.existsSync(peopleFile)) fs.writeFileSync(peopleFile, '[]');

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use(requirePassword(process.env.APP_PASSWORD));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/parse', parseRoute);
app.use('/api/people', peopleRoute);

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
