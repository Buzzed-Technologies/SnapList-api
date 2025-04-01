const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

/**
 * @route GET /api/profits
 * @desc Get all profits for a user
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { user_id, status, limit = 20, offset = 0 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    let query = supabase
      .from('profits')
      .select(`
        *,
        listings (
          title,
          image_urls,
          price,
          original_price
        )
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error, count } = await query
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (error) {
      console.error('Error fetching profits:', error);
      return res.status(500).json({ success: false, message: `Failed to fetch profits: ${error.message}` });
    }
    
    // Calculate total profit
    const totalProfit = data.reduce((sum, profit) => sum + parseFloat(profit.amount), 0);
    
    res.status(200).json({
      success: true,
      profits: data,
      total: totalProfit,
      count: data.length
    });
  } catch (error) {
    console.error('Error in GET /profits:', error);
    res.status(500).json({ success: false, message: `Failed to fetch profits: ${error.message}` });
  }
});

/**
 * @route GET /api/profits/:id
 * @desc Get a specific profit
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: profit, error } = await supabase
      .from('profits')
      .select(`
        *,
        listings (
          title,
          description,
          image_urls,
          price,
          original_price,
          ebay_listing_id,
          facebook_listing_id
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      console.error(`Error fetching profit ${id}:`, error);
      return res.status(500).json({ success: false, message: `Failed to fetch profit: ${error.message}` });
    }
    
    if (!profit) {
      return res.status(404).json({ success: false, message: 'Profit not found' });
    }
    
    res.status(200).json({
      success: true,
      profit
    });
  } catch (error) {
    console.error(`Error in GET /profits/${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to fetch profit: ${error.message}` });
  }
});

/**
 * @route PUT /api/profits/:id
 * @desc Update a profit's status (e.g., mark as completed)
 * @access Public
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['pending', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status is required (pending or completed)' });
    }
    
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'completed' && !req.body.completed_at) {
      updates.completed_at = new Date().toISOString();
    } else if (req.body.completed_at) {
      updates.completed_at = req.body.completed_at;
    }
    
    const { data: updatedProfit, error } = await supabase
      .from('profits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error(`Error updating profit ${id}:`, error);
      return res.status(500).json({ success: false, message: `Failed to update profit: ${error.message}` });
    }
    
    res.status(200).json({
      success: true,
      profit: updatedProfit
    });
  } catch (error) {
    console.error(`Error in PUT /profits/${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to update profit: ${error.message}` });
  }
});

/**
 * @route GET /api/profits/summary
 * @desc Get a summary of profits for a user
 * @access Public
 */
router.get('/summary', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    // Get all profits for the user
    const { data: profits, error } = await supabase
      .from('profits')
      .select('amount, status, platform, created_at')
      .eq('user_id', user_id);
    
    if (error) {
      console.error('Error fetching profits for summary:', error);
      return res.status(500).json({ success: false, message: `Failed to fetch profits: ${error.message}` });
    }
    
    // Calculate summary
    const summary = {
      totalProfit: 0,
      pendingProfit: 0,
      completedProfit: 0,
      byPlatform: {
        ebay: 0,
        facebook: 0
      },
      byMonth: {}
    };
    
    profits.forEach(profit => {
      const amount = parseFloat(profit.amount);
      summary.totalProfit += amount;
      
      if (profit.status === 'pending') {
        summary.pendingProfit += amount;
      } else {
        summary.completedProfit += amount;
      }
      
      if (profit.platform === 'ebay') {
        summary.byPlatform.ebay += amount;
      } else if (profit.platform === 'facebook') {
        summary.byPlatform.facebook += amount;
      }
      
      // Group by month
      const date = new Date(profit.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!summary.byMonth[monthKey]) {
        summary.byMonth[monthKey] = 0;
      }
      summary.byMonth[monthKey] += amount;
    });
    
    // Convert byMonth to array for easier frontend processing
    const byMonthArray = Object.entries(summary.byMonth)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    res.status(200).json({
      success: true,
      summary: {
        ...summary,
        byMonth: byMonthArray,
        totalCount: profits.length
      }
    });
  } catch (error) {
    console.error('Error in GET /profits/summary:', error);
    res.status(500).json({ success: false, message: `Failed to fetch profit summary: ${error.message}` });
  }
});

module.exports = router; 