const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { supabase } = require('../config/supabase');

// Generate a verification token if one doesn't exist
// The verification token has to be between 32 and 80 characters
const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN || crypto.randomBytes(32).toString('hex');

// Print token for initial setup - you should save this to your environment variables
console.log('eBay Verification Token:', VERIFICATION_TOKEN);

// The base URL for your endpoint (used in challenge verification)
const BASE_URL = process.env.API_BASE_URL || 'https://your-api-domain.com';
const ENDPOINT_URL = `${BASE_URL}/api/ebay-webhooks/account-deletion`;

/**
 * Challenge Response Handler - This handles eBay's GET request with challenge_code
 * This is required for verifying ownership of the endpoint
 */
router.get('/account-deletion', (req, res) => {
  try {
    const challengeCode = req.query.challenge_code;
    
    if (!challengeCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing challenge_code query parameter'
      });
    }
    
    // Hash the challengeCode + verificationToken + endpoint in that exact order
    const hash = crypto.createHash('sha256');
    hash.update(challengeCode);
    hash.update(VERIFICATION_TOKEN);
    hash.update(ENDPOINT_URL);
    const challengeResponse = hash.digest('hex');
    
    console.log('Received challenge code:', challengeCode);
    console.log('Generated challenge response:', challengeResponse);
    
    // Return the challenge response as required by eBay
    return res.status(200).json({
      challengeResponse: challengeResponse
    });
  } catch (error) {
    console.error('Error processing challenge code:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing challenge code'
    });
  }
});

/**
 * Marketplace Account Deletion Endpoint
 * This endpoint handles eBay's marketplace account deletion notifications
 * as required for Production API access
 */
router.post('/account-deletion', async (req, res) => {
  try {
    console.log('Received eBay account deletion notification:', JSON.stringify(req.body));

    // First immediately acknowledge the notification with 200 OK
    // As per eBay's documentation, we should always acknowledge first
    
    // Later, we should verify the signature using one of eBay's SDKs
    // or following their manual validation process
    // For now, we'll just log the signature for debugging
    const ebaySignature = req.headers['x-ebay-signature'];
    console.log('Received eBay signature:', ebaySignature);
    
    // Process the notification data according to eBay's format
    const notification = req.body && req.body.notification;
    const metadata = req.body && req.body.metadata;
    
    if (!notification || !notification.data || !notification.data.userId) {
      console.warn('Malformed notification data received', req.body);
      // Still return 200 as eBay requires acknowledgment
      return res.status(200).json({
        success: true,
        message: 'Notification received but data format not recognized'
      });
    }
    
    const userId = notification.data.userId;
    const username = notification.data.username;
    const eiasToken = notification.data.eiasToken;
    const eventDate = notification.eventDate;
    
    // Log the deletion request to the database
    await supabase
      .from('ebay_account_deletions')
      .insert({
        ebay_user_id: userId,
        ebay_username: username || null,
        deletion_date: eventDate || new Date().toISOString(),
        request_body: req.body
      });

    // Here you would implement logic to:
    // 1. Find any users associated with this eBay account
    // 2. Delete their eBay-related data
    // 3. Notify them if needed

    // Return success - always return 200 to acknowledge notification
    return res.status(200).json({
      success: true,
      message: 'Account deletion notification received and will be processed'
    });
  } catch (error) {
    console.error('Error processing eBay account deletion:', error);
    // Still return 200 as eBay requires acknowledgment
    return res.status(200).json({
      success: true,
      message: 'Notification received, but processing encountered an error'
    });
  }
});

/**
 * Debugging endpoint that returns information about the verification setup
 * You can use this during development, but should remove or secure it in production
 */
router.get('/verification', (req, res) => {
  res.status(200).json({
    endpoint_url: ENDPOINT_URL,
    verification_token_preview: VERIFICATION_TOKEN ? `${VERIFICATION_TOKEN.substring(0, 4)}...` : 'Not set',
    challenge_code_example: 'ab123',
    instructions: 'When eBay sends a challenge_code, we hash challengeCode+verificationToken+endpointURL',
    setup_instructions: 'See https://developer.ebay.com/marketplace-account-deletion for details'
  });
});

module.exports = router; 