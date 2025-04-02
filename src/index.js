require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const scheduler = require('node-schedule');
const os = require('os');

// Import routes
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const profitsRoutes = require('./routes/profits');
const imagesRoutes = require('./routes/images');
const payoutsRoutes = require('./routes/payouts');
const shareRoutes = require('./routes/share');
const adminRoutes = require('./routes/admin');

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

// Admin authentication middleware
function adminAuthCheck(req, res, next) {
  // In a production environment, you'd implement proper session-based auth
  // For this simple implementation, we'll trust the client-side auth
  // and focus on serving the pages
  next();
}

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/profits', profitsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/payouts', payoutsRoutes);
app.use('/share', shareRoutes);
app.use('/api/admin', adminRoutes);

// Admin pages routes
app.get('/admin', (req, res) => {
  res.redirect('/admin/login.html');
});

app.get('/admin/login.html', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'admin/login.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('Admin login page not found at path:', htmlPath);
      res.status(404).send('Admin login page not found');
    }
  } catch (error) {
    console.error('Error serving admin login page:', error);
    res.status(500).send('Error loading admin login page');
  }
});

app.get('/admin/dashboard.html', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'admin/dashboard.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('Admin dashboard page not found at path:', htmlPath);
      res.status(404).send('Admin dashboard page not found');
    }
  } catch (error) {
    console.error('Error serving admin dashboard page:', error);
    res.status(500).send('Error loading admin dashboard page');
  }
});

// Add routes for all other admin pages
app.get('/admin/users.html', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'admin/users.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('Admin users page not found at path:', htmlPath);
      res.status(404).send('Admin users page not found');
    }
  } catch (error) {
    console.error('Error serving admin users page:', error);
    res.status(500).send('Error loading admin users page');
  }
});

app.get('/admin/listings.html', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'admin/listings.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('Admin listings page not found at path:', htmlPath);
      res.status(404).send('Admin listings page not found');
    }
  } catch (error) {
    console.error('Error serving admin listings page:', error);
    res.status(500).send('Error loading admin listings page');
  }
});

app.get('/admin/payouts.html', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'admin/payouts.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('Admin payouts page not found at path:', htmlPath);
      res.status(404).send('Admin payouts page not found');
    }
  } catch (error) {
    console.error('Error serving admin payouts page:', error);
    res.status(500).send('Error loading admin payouts page');
  }
});

app.get('/admin/support.html', (req, res) => {
  try {
    const htmlPath = path.join(publicPath, 'admin/support.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      console.error('Admin support page not found at path:', htmlPath);
      res.status(404).send('Admin support page not found');
    }
  } catch (error) {
    console.error('Error serving admin support page:', error);
    res.status(500).send('Error loading admin support page');
  }
});

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