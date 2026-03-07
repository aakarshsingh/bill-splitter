require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const parseRoute = require('./routes/parse');
const peopleRoute = require('./routes/people');
const preferencesRoute = require('./routes/preferences');
const assignRoute = require('./routes/assign');
const saveRoute = require('./routes/save');
const loadRoute = require('./routes/load');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/parse', parseRoute);
app.use('/api/people', peopleRoute);
app.use('/api/preferences', preferencesRoute);
app.use('/api/assign', assignRoute);
app.use('/api/save', saveRoute);
app.use('/api/load', loadRoute);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
