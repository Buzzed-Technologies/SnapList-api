const express = require('express');
const payoutService = require('../services/payoutService');

const router = express.Router();

/**
 * @route GET /api/payouts/available/:userId
 * @desc Get available payout amount for a user
 * @access Public
 */
router.get('/available/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await payoutService.getUserAvailablePayoutAmount(userId);
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(200).json({
      success: true,
      amount: result.amount
    });
  } catch (error) {
    console.error(`Error in GET /payouts/available/${req.params.userId}:`, error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
});

/**
 * @route POST /api/payouts
 * @desc Create a new payout request
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, amount, phone } = req.body;
    
    if (!user_id || !amount || !phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: user_id, amount, phone' 
      });
    }
    
    const result = await payoutService.createPayoutRequest({
      user_id,
      amount: parseFloat(amount),
      phone
    });
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(201).json({
      success: true,
      payout: result.payout
    });
  } catch (error) {
    console.error('Error in POST /payouts:', error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
});

/**
 * @route GET /api/payouts/user/:userId
 * @desc Get payout requests for a user
 * @access Public
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await payoutService.getUserPayouts(userId);
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(200).json({
      success: true,
      payouts: result.payouts
    });
  } catch (error) {
    console.error(`Error in GET /payouts/user/${req.params.userId}:`, error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
});

/**
 * @route PUT /api/payouts/:payoutId
 * @desc Update payout request status (for admin use)
 * @access Public (would typically be restricted to admins in production)
 */
router.put('/:payoutId', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { status, notes } = req.body;
    
    if (!status || !['completed', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status must be either "completed" or "rejected"' 
      });
    }
    
    const result = await payoutService.updatePayoutStatus(payoutId, status, notes);
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(200).json({
      success: true,
      payout: result.payout
    });
  } catch (error) {
    console.error(`Error in PUT /payouts/${req.params.payoutId}:`, error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
});

module.exports = router;
