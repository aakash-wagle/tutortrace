require('dotenv').config();
const express = require('express');
const cors = require('cors');
const coursePlanRoutes = require('./routes/coursePlan');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/course-plan', coursePlanRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Course Plan Service running on http://localhost:${PORT}`);
});
