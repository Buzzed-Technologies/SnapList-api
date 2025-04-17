const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { supabase } = require('../config/supabase');

// Generate a verification token if one doesn't exist
const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN || crypto.randomBytes(32).toString('hex');

// Store this token somewhere (environment variable, database, etc.)
console.log('eBay Verification Token:', VERIFICATION_TOKEN);

/**
 * Marketplace Account Deletion Endpoint
 * This endpoint handles eBay's marketplace account deletion notifications
 * as required for Production API access
 */
router.post('/account-deletion', async (req, res) => {
  try {
    console.log('Received eBay account deletion notification:', JSON.stringify(req.body));

    // Validate the request with the verification token if eBay sends one in headers
    const ebaySignature = req.headers['x-ebay-signature'];
    if (ebaySignature && ebaySignature !== VERIFICATION_TOKEN) {
      console.error('Invalid eBay signature');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    // Process the account deletion request
    const { userId, username, deletionDate } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId in request body' });
    }

    // Log the deletion request to the database
    await supabase
      .from('ebay_account_deletions')
      .insert({
        ebay_user_id: userId,
        ebay_username: username || null,
        deletion_date: deletionDate || new Date().toISOString(),
        request_body: req.body
      });

    // Here you would implement logic to:
    // 1. Find any users associated with this eBay account
    // 2. Delete their eBay-related data
    // 3. Notify them if needed

    // Return success
    return res.status(200).json({
      success: true,
      message: 'Account deletion notification received and processed'
    });
  } catch (error) {
    console.error('Error processing eBay account deletion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing account deletion notification'
    });
  }
});

/**
 * Verification Endpoint
 * This endpoint returns the verification token for eBay to verify
 */
router.get('/verification', (req, res) => {
  res.status(200).json({
    verification_token: VERIFICATION_TOKEN
  });
});

module.exports = router; 