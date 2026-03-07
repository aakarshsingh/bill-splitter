const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes will be added here as screens are built

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
