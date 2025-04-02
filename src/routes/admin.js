const express = require('express');
const { supabase } = require('../config/supabase');
const router = express.Router();

/**
 * @route GET /api/admin/stats
 * @desc Get overall platform statistics
 * @access Admin
 */
router.get('/stats', async (req, res) => {
  try {
    // Get total users count
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
      
    if (userError) throw userError;
    
    // Get total listings count
    const { count: listingCount, error: listingError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true });
      
    if (listingError) throw listingError;
    
    // Get active listings
    const { count: activeListingCount, error: activeListingError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
      
    if (activeListingError) throw activeListingError;
    
    // Get total sales
    const { count: soldCount, error: soldError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sold');
      
    if (soldError) throw soldError;
    
    // Get sum of profits
    const { data: profitData, error: profitError } = await supabase
      .from('profits')
      .select('amount');
      
    if (profitError) throw profitError;
    
    const totalProfit = profitData.reduce((sum, profit) => sum + profit.amount, 0);
    const totalCommission = totalProfit * 0.025; // 2.5% commission
    
    res.status(200).json({
      success: true,
      stats: {
        userCount,
        listingCount,
        activeListingCount,
        soldCount,
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        totalCommission: parseFloat(totalCommission.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, message: `Failed to fetch stats: ${error.message}` });
  }
});

/**
 * @route GET /api/admin/users
 * @desc Get all users
 * @access Admin
 */
router.get('/users', async (req, res) => {
  try {
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      users: data,
      count
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: `Failed to fetch users: ${error.message}` });
  }
});

/**
 * @route GET /api/admin/listings
 * @desc Get all listings
 * @access Admin
 */
router.get('/listings', async (req, res) => {
  try {
    const { data, error, count } = await supabase
      .from('listings')
      .select('*, users!inner(*)', { count: 'exact' })
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      listings: data,
      count
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ success: false, message: `Failed to fetch listings: ${error.message}` });
  }
});

/**
 * @route GET /api/admin/payouts
 * @desc Get all payouts
 * @access Admin
 */
router.get('/payouts', async (req, res) => {
  try {
    const { data, error, count } = await supabase
      .from('payouts')
      .select('*, users!inner(*)', { count: 'exact' })
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      payouts: data,
      count
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({ success: false, message: `Failed to fetch payouts: ${error.message}` });
  }
});

/**
 * @route GET /api/admin/support-chats
 * @desc Get all support chats
 * @access Admin
 */
router.get('/support-chats', async (req, res) => {
  try {
    const { data, error, count } = await supabase
      .from('support_chats')
      .select('*, users!inner(*)', { count: 'exact' })
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      chats: data,
      count
    });
  } catch (error) {
    console.error('Error fetching support chats:', error);
    res.status(500).json({ success: false, message: `Failed to fetch support chats: ${error.message}` });
  }
});

/**
 * @route POST /api/admin/support-chats/:id/respond
 * @desc Respond to a support chat
 * @access Admin
 */
router.post('/support-chats/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    
    if (!response) {
      return res.status(400).json({ success: false, message: 'Response message is required' });
    }
    
    // Update the support chat with admin response
    const { data, error } = await supabase
      .from('support_chats')
      .update({ 
        admin_response: response,
        status: 'responded',
        responded_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
      
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      chat: data[0]
    });
  } catch (error) {
    console.error(`Error responding to support chat ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to respond to support chat: ${error.message}` });
  }
});

/**
 * @route POST /api/admin/process-payout/:id
 * @desc Process a payout manually
 * @access Admin
 */
router.post('/process-payout/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update the payout status to completed
    const { data, error } = await supabase
      .from('payouts')
      .update({ 
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
      
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      payout: data[0]
    });
  } catch (error) {
    console.error(`Error processing payout ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to process payout: ${error.message}` });
  }
});

module.exports = router; 