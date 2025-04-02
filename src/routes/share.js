const express = require('express');
const router = express.Router();
const path = require('path');
const { getListingById } = require('../services/listingService');

// Serve HTML share page
router.get('/listing/:id', async (req, res) => {
  try {
    const listingId = req.params.id;
    const result = await getListingById(listingId);
    
    if (!result || !result.listing) {
      return res.status(404).send('Listing not found');
    }
    
    // Redirect to the HTML route with the ID as a query parameter
    res.redirect(`/share/listing/html?id=${listingId}`);
  } catch (error) {
    console.error('Error serving shared listing:', error);
    res.status(500).send('Error loading listing');
  }
});

// API endpoint to get listing data for the share page
router.get('/data/:id', async (req, res) => {
  try {
    const listingId = req.params.id;
    const result = await getListingById(listingId);
    
    if (!result || !result.listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    return res.status(200).json({
      success: true,
      listing: result.listing,
      priceHistory: result.priceHistory
    });
  } catch (error) {
    console.error('Error fetching shared listing data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error loading listing data' 
    });
  }
});

module.exports = router; 