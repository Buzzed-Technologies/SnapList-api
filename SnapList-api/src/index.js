require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const scheduler = require('node-schedule');

// Import routes
const usersRoutes = require('./routes/users');
const listingsRoutes = require('./routes/listings');
const profitsRoutes = require('./routes/profits');
const imagesRoutes = require('./routes/images');

// Import price reduction service
const { schedulePriceReductions } = require('./services/priceService');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/users', usersRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/profits', profitsRoutes);
app.use('/api/images', imagesRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'SnapList API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.statusCode || 500
    }
  });
});

// Schedule automatic price reductions (runs every day at midnight)
scheduler.scheduleJob('0 0 * * *', schedulePriceReductions);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app; // Export for testing 