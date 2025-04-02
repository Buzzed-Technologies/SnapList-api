const express = require('express');
const { supabase } = require('../config/supabase');
const router = express.Router();
const { getUserById } = require('../utils/user');

/**
 * @api {get} /api/admin/stats Get dashboard statistics
 * @apiDescription Get key statistics for the admin dashboard
 * @apiName GetDashboardStats
 * @apiGroup Admin
 * 
 * @apiSuccess {Object} data Dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Total revenue calculation
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('price');
    
    if (salesError) throw salesError;
    
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.price, 0);
    
    // Active users count
    const { count: activeUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (usersError) throw usersError;
    
    // Active listings count
    const { count: activeListings, error: listingsError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    if (listingsError) throw listingsError;
    
    // Completed sales count
    const { count: completedSales, error: completedSalesError } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true });
    
    if (completedSalesError) throw completedSalesError;
    
    // Recent 5 sales
    const { data: recentSales, error: recentSalesError } = await supabase
      .from('sales')
      .select(`
        id,
        listing_id,
        price,
        created_at,
        listings(title, user_id),
        users!sales_user_id_fkey(name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentSalesError) throw recentSalesError;
    
    // Format recent sales for frontend
    const formattedRecentSales = recentSales.map(sale => ({
      id: sale.id,
      title: sale.listings?.title || 'Unknown Item',
      price: sale.price,
      created_at: sale.created_at,
      seller_name: sale.users?.name || 'Unknown Seller'
    }));
    
    // Pending payouts
    const { data: pendingPayouts, error: pendingPayoutsError } = await supabase
      .from('payouts')
      .select(`
        id,
        user_id,
        amount,
        created_at,
        users(name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (pendingPayoutsError) throw pendingPayoutsError;
    
    // Format pending payouts for frontend
    const formattedPendingPayouts = pendingPayouts.map(payout => ({
      id: payout.id,
      amount: payout.amount,
      created_at: payout.created_at,
      user_id: payout.user_id,
      user_name: payout.users?.name || 'Unknown User'
    }));
    
    // Recent support chats
    const { data: supportChats, error: supportChatsError } = await supabase
      .from('support_chats')
      .select(`
        id,
        user_id,
        message,
        created_at,
        status,
        users(name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (supportChatsError) throw supportChatsError;
    
    // Format support chats for frontend
    const formattedSupportChats = supportChats.map(chat => ({
      id: chat.id,
      message: chat.message,
      created_at: chat.created_at,
      status: chat.status,
      user_id: chat.user_id,
      user_name: chat.users?.name || 'Anonymous'
    }));
    
    res.json({
      success: true,
      stats: {
        totalRevenue,
        activeUsers,
        activeListings,
        completedSales
      },
      recentSales: formattedRecentSales,
      pendingPayouts: formattedPendingPayouts,
      supportChats: formattedSupportChats
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics'
    });
  }
});

/**
 * @api {get} /api/admin/users Get all users
 * @apiDescription Get a paginated list of all users
 * @apiName GetUsers
 * @apiGroup Admin
 * 
 * @apiParam {Number} [page=1] Page number
 * @apiParam {Number} [limit=10] Number of users per page
 * @apiParam {String} [search] Search term to filter users by name or phone
 * @apiParam {String} [sort_by=created_at] Field to sort by
 * @apiParam {String} [sort_dir=desc] Sort direction (asc or desc)
 * 
 * @apiSuccess {Object[]} users Array of users
 * @apiSuccess {Number} count Total count of users
 */
router.get('/users', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      sort_by = 'created_at', 
      sort_dir = 'desc' 
    } = req.query;
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Start building query
    let query = supabase
      .from('users')
      .select(`
        *,
        listings(count),
        sales(count)
      `, { count: 'exact' });
    
    // Add search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    
    // Add sorting
    query = query.order(sort_by, { ascending: sort_dir === 'asc' });
    
    // Add pagination
    query = query.range(offset, offset + limit - 1);
    
    // Execute query
    const { data: users, count, error } = await query;
    
    if (error) throw error;
    
    // Format user data for frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
      zelle_id: user.zelle_id,
      paypal_id: user.paypal_id,
      venmo_id: user.venmo_id,
      cashapp_id: user.cashapp_id,
      active_listings_count: user.listings ? user.listings.length : 0,
      sold_items_count: user.sales ? user.sales.length : 0
    }));
    
    res.json({
      success: true,
      users: formattedUsers,
      count
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

/**
 * @api {delete} /api/admin/users/:id Delete a user
 * @apiDescription Delete a user and all associated data
 * @apiName DeleteUser
 * @apiGroup Admin
 * 
 * @apiParam {String} id User ID
 * 
 * @apiSuccess {Boolean} success Indicates if the operation was successful
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete user from database
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

/**
 * @api {get} /api/admin/listings Get all listings
 * @apiDescription Get a paginated list of all listings
 * @apiName GetListings
 * @apiGroup Admin
 * 
 * @apiParam {Number} [page=1] Page number
 * @apiParam {Number} [limit=12] Number of listings per page
 * @apiParam {String} [search] Search term to filter listings by title or description
 * @apiParam {String} [status] Filter by listing status
 * @apiParam {Number} [min_price] Filter by minimum price
 * @apiParam {Number} [max_price] Filter by maximum price
 * @apiParam {String} [sort_by=created_at] Field to sort by
 * @apiParam {String} [sort_dir=desc] Sort direction (asc or desc)
 * 
 * @apiSuccess {Object[]} listings Array of listings
 * @apiSuccess {Number} count Total count of listings
 */
router.get('/listings', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      search = '', 
      status = '',
      min_price = '',
      max_price = '',
      sort_by = 'created_at', 
      sort_dir = 'desc' 
    } = req.query;
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Start building query
    let query = supabase
      .from('listings')
      .select(`
        *,
        users(name)
      `, { count: 'exact' });
    
    // Add search filter if provided
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Add price filters if provided
    if (min_price) {
      query = query.gte('price', min_price);
    }
    
    if (max_price) {
      query = query.lte('price', max_price);
    }
    
    // Add sorting
    query = query.order(sort_by, { ascending: sort_dir === 'asc' });
    
    // Add pagination
    query = query.range(offset, offset + limit - 1);
    
    // Execute query
    const { data: listings, count, error } = await query;
    
    if (error) throw error;
    
    // Format listing data for frontend
    const formattedListings = listings.map(listing => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      images: listing.images,
      status: listing.status,
      created_at: listing.created_at,
      updated_at: listing.updated_at,
      user_id: listing.user_id,
      user_name: listing.users?.name || 'Unknown'
    }));
    
    res.json({
      success: true,
      listings: formattedListings,
      count
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch listings'
    });
  }
});

/**
 * @api {put} /api/admin/listings/:id/status Update listing status
 * @apiDescription Update the status of a listing
 * @apiName UpdateListingStatus
 * @apiGroup Admin
 * 
 * @apiParam {String} id Listing ID
 * @apiParam {String} status New status
 * 
 * @apiSuccess {Boolean} success Indicates if the operation was successful
 */
router.put('/listings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Update listing status
    const { error } = await supabase
      .from('listings')
      .update({ status, updated_at: new Date() })
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Listing status updated successfully'
    });
  } catch (error) {
    console.error('Error updating listing status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update listing status'
    });
  }
});

/**
 * @api {get} /api/admin/payouts Get all payouts
 * @apiDescription Get a paginated list of all payouts
 * @apiName GetPayouts
 * @apiGroup Admin
 * 
 * @apiParam {Number} [page=1] Page number
 * @apiParam {Number} [limit=10] Number of payouts per page
 * @apiParam {String} [search] Search term to filter payouts by user name
 * @apiParam {String} [status] Filter by payout status
 * @apiParam {String} [sort_by=created_at] Field to sort by
 * @apiParam {String} [sort_dir=desc] Sort direction (asc or desc)
 * 
 * @apiSuccess {Object[]} payouts Array of payouts
 * @apiSuccess {Number} count Total count of payouts
 */
router.get('/payouts', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '',
      sort_by = 'created_at', 
      sort_dir = 'desc' 
    } = req.query;
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Start building query
    let query = supabase
      .from('payouts')
      .select(`
        *,
        users(name),
        payout_items(id)
      `, { count: 'exact' });
    
    // Add search filter by user name
    if (search) {
      query = query.or(`users.name.ilike.%${search}%`);
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Add sorting
    query = query.order(sort_by, { ascending: sort_dir === 'asc' });
    
    // Add pagination
    query = query.range(offset, offset + limit - 1);
    
    // Execute query
    const { data: payouts, count, error } = await query;
    
    if (error) throw error;
    
    // Format payout data for frontend
    const formattedPayouts = payouts.map(payout => ({
      id: payout.id,
      user_id: payout.user_id,
      user_name: payout.users?.name || 'Unknown',
      amount: payout.amount,
      items_count: payout.payout_items ? payout.payout_items.length : 0,
      status: payout.status,
      payment_method: payout.payment_method,
      payment_id: payout.payment_id,
      created_at: payout.created_at,
      updated_at: payout.updated_at
    }));
    
    res.json({
      success: true,
      payouts: formattedPayouts,
      count
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payouts'
    });
  }
});

/**
 * @api {get} /api/admin/payouts/stats Get payout statistics
 * @apiDescription Get statistics about payouts
 * @apiName GetPayoutStats
 * @apiGroup Admin
 * 
 * @apiSuccess {Object} stats Payout statistics
 */
router.get('/payouts/stats', async (req, res) => {
  try {
    // Get pending payouts
    const { data: pendingPayouts, error: pendingError } = await supabase
      .from('payouts')
      .select('amount')
      .eq('status', 'pending');
    
    if (pendingError) throw pendingError;
    
    const pendingAmount = pendingPayouts.reduce((sum, payout) => sum + payout.amount, 0);
    const pendingCount = pendingPayouts.length;
    
    // Get payouts processed this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const { data: monthlyPayouts, error: monthlyError } = await supabase
      .from('payouts')
      .select('amount')
      .eq('status', 'paid')
      .gte('updated_at', startOfMonth.toISOString());
    
    if (monthlyError) throw monthlyError;
    
    const monthlyAmount = monthlyPayouts.reduce((sum, payout) => sum + payout.amount, 0);
    const monthlyCount = monthlyPayouts.length;
    
    // Get average processing time (in days)
    const { data: processedPayouts, error: processedError } = await supabase
      .from('payouts')
      .select('created_at, updated_at')
      .eq('status', 'paid');
    
    if (processedError) throw processedError;
    
    let avgProcessingDays = 0;
    if (processedPayouts.length > 0) {
      const totalDays = processedPayouts.reduce((sum, payout) => {
        const created = new Date(payout.created_at);
        const updated = new Date(payout.updated_at);
        const diffTime = Math.abs(updated - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return sum + diffDays;
      }, 0);
      avgProcessingDays = totalDays / processedPayouts.length;
    }
    
    // Calculate processing time change from previous month
    const previousMonth = new Date(startOfMonth);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    
    const { data: previousMonthPayouts, error: prevMonthError } = await supabase
      .from('payouts')
      .select('created_at, updated_at')
      .eq('status', 'paid')
      .gte('updated_at', previousMonth.toISOString())
      .lt('updated_at', startOfMonth.toISOString());
    
    if (prevMonthError) throw prevMonthError;
    
    let prevAvgProcessingDays = 0;
    if (previousMonthPayouts.length > 0) {
      const totalDays = previousMonthPayouts.reduce((sum, payout) => {
        const created = new Date(payout.created_at);
        const updated = new Date(payout.updated_at);
        const diffTime = Math.abs(updated - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return sum + diffDays;
      }, 0);
      prevAvgProcessingDays = totalDays / previousMonthPayouts.length;
    }
    
    const processingDaysChange = prevAvgProcessingDays > 0 
      ? avgProcessingDays - prevAvgProcessingDays 
      : 0;
    
    res.json({
      success: true,
      pendingAmount,
      pendingCount,
      monthlyAmount,
      monthlyCount,
      avgProcessingDays,
      processingDaysChange
    });
  } catch (error) {
    console.error('Error fetching payout stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payout statistics'
    });
  }
});

/**
 * @api {post} /api/admin/payouts/:id/process Process a payout
 * @apiDescription Mark a payout as processed
 * @apiName ProcessPayout
 * @apiGroup Admin
 * 
 * @apiParam {String} id Payout ID
 * 
 * @apiSuccess {Boolean} success Indicates if the operation was successful
 */
router.post('/payouts/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update payout status
    const { data, error } = await supabase
      .from('payouts')
      .update({ 
        status: 'paid',
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Payout processed successfully',
      payout: data
    });
  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payout'
    });
  }
});

/**
 * @api {post} /api/admin/payouts/process-all Process all pending payouts
 * @apiDescription Mark all pending payouts as processed
 * @apiName ProcessAllPayouts
 * @apiGroup Admin
 * 
 * @apiSuccess {Boolean} success Indicates if the operation was successful
 * @apiSuccess {Number} processed_count Number of payouts processed
 */
router.post('/payouts/process-all', async (req, res) => {
  try {
    // Update all pending payouts to paid
    const { data, error } = await supabase
      .from('payouts')
      .update({ 
        status: 'paid',
        updated_at: new Date()
      })
      .eq('status', 'pending')
      .select();
    
    if (error) throw error;
    
    const processedCount = data ? data.length : 0;
    
    res.json({
      success: true,
      message: 'All pending payouts processed successfully',
      processed_count: processedCount
    });
  } catch (error) {
    console.error('Error processing all payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payouts'
    });
  }
});

/**
 * @api {get} /api/admin/support-chats Get all support chats
 * @apiDescription Get all support chats, optionally filtered
 * @apiName GetSupportChats
 * @apiGroup Admin
 * 
 * @apiParam {String} [search] Search term to filter chats by message content or user name
 * @apiParam {String} [status] Filter by chat status
 * 
 * @apiSuccess {Object[]} chats Array of support chats
 */
router.get('/support-chats', async (req, res) => {
  try {
    const { search = '', status = '' } = req.query;
    
    // Start building query
    let query = supabase
      .from('support_chats')
      .select(`
        *,
        users(name)
      `);
    
    // Add search filter if provided
    if (search) {
      query = query.or(`message.ilike.%${search}%,users.name.ilike.%${search}%`);
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Sort by most recent first
    query = query.order('created_at', { ascending: false });
    
    // Execute query
    const { data: chats, error } = await query;
    
    if (error) throw error;
    
    // Format chat data for frontend
    const formattedChats = chats.map(chat => ({
      id: chat.id,
      user_id: chat.user_id,
      user_name: chat.users?.name || 'Anonymous',
      message: chat.message,
      ai_response: chat.ai_response,
      admin_response: chat.admin_response,
      status: chat.status,
      created_at: chat.created_at,
      updated_at: chat.updated_at
    }));
    
    res.json({
      success: true,
      chats: formattedChats
    });
  } catch (error) {
    console.error('Error fetching support chats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support chats'
    });
  }
});

/**
 * @api {post} /api/admin/support-chats/:id/reply Reply to a support chat
 * @apiDescription Add an admin reply to a support chat
 * @apiName ReplySupportChat
 * @apiGroup Admin
 * 
 * @apiParam {String} id Chat ID
 * @apiParam {String} message Admin reply message
 * 
 * @apiSuccess {Boolean} success Indicates if the operation was successful
 */
router.post('/support-chats/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required'
      });
    }
    
    // Update chat with admin response and change status to responded
    const { data, error } = await supabase
      .from('support_chats')
      .update({ 
        admin_response: message,
        status: 'responded',
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Reply sent successfully',
      chat: data
    });
  } catch (error) {
    console.error('Error replying to support chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply'
    });
  }
});

/**
 * @api {put} /api/admin/support-chats/:id/status Update support chat status
 * @apiDescription Update the status of a support chat
 * @apiName UpdateSupportChatStatus
 * @apiGroup Admin
 * 
 * @apiParam {String} id Chat ID
 * @apiParam {String} status New status
 * 
 * @apiSuccess {Boolean} success Indicates if the operation was successful
 */
router.put('/support-chats/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Update chat status
    const { data, error } = await supabase
      .from('support_chats')
      .update({ 
        status,
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Support chat status updated successfully',
      chat: data
    });
  } catch (error) {
    console.error('Error updating support chat status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
});

module.exports = router; 