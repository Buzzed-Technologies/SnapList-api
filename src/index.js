require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const scheduler = require('node-schedule');
const os = require('os');

// Import routes
const usersRoutes = require('./routes/users');
const listingsRoutes = require('./routes/listings');
const profitsRoutes = require('./routes/profits');
const imagesRoutes = require('./routes/images');
const payoutsRoutes = require('./routes/payouts');
const shareRoutes = require('./routes/share');

// Import price reduction service
const { schedulePriceReductions } = require('./services/priceService');

const app = express();
const PORT = process.env.PORT || 3000;

// Create temporary directory for file uploads if needed
const tempDir = path.join(os.tmpdir(), 'snaplist-uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set public directory explicitly using __dirname
const publicPath = path.join(__dirname, 'public');
console.log('Public directory path:', publicPath);

// Serve static files for shared listings
app.use('/static', express.static(publicPath));

// Add a direct route for listing.html
app.get('/share/listing/html', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'listing.html');
    console.log('Serving HTML from:', htmlPath);
    
    // First check if the file exists
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('HTML file not found at path:', htmlPath);
      res.status(404).send('Listing page not found');
    }
  } catch (error) {
    console.error('Error serving listing HTML:', error);
    res.status(500).send('Error loading listing page');
  }
});

// Add routes for terms of service and privacy policy
app.get('/terms', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'terms.html');
    console.log('Serving Terms of Service from:', htmlPath);
    
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('Terms of Service file not found at path:', htmlPath);
      res.status(404).send('Terms of Service page not found');
    }
  } catch (error) {
    console.error('Error serving Terms of Service HTML:', error);
    res.status(500).send('Error loading Terms of Service page');
  }
});

app.get('/privacy', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'privacy.html');
    console.log('Serving Privacy Policy from:', htmlPath);
    
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('Privacy Policy file not found at path:', htmlPath);
      res.status(404).send('Privacy Policy page not found');
    }
  } catch (error) {
    console.error('Error serving Privacy Policy HTML:', error);
    res.status(500).send('Error loading Privacy Policy page');
  }
});

// Routes
app.use('/api/users', usersRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/profits', profitsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/payouts', payoutsRoutes);
app.use('/share', shareRoutes);

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