require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const parseRoute = require('./routes/parse');
const peopleRoute = require('./routes/people');
const preferencesRoute = require('./routes/preferences');
const assignRoute = require('./routes/assign');
const saveRoute = require('./routes/save');
const loadRoute = require('./routes/load');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directories exist
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const historyDir = path.join(dataDir, 'history');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

// Initialize data files if missing
const peopleFile = path.join(dataDir, 'people.json');
const prefsFile = path.join(dataDir, 'preferences.json');
if (!fs.existsSync(peopleFile)) fs.writeFileSync(peopleFile, '[]');
if (!fs.existsSync(prefsFile)) fs.writeFileSync(prefsFile, '{}');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/parse', parseRoute);
app.use('/api/people', peopleRoute);
app.use('/api/preferences', preferencesRoute);
app.use('/api/assign', assignRoute);
app.use('/api/save', saveRoute);
app.use('/api/load', loadRoute);

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
