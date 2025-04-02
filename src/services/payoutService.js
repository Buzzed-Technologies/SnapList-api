const { supabase } = require('../config/supabase');

/**
 * Get user's available payout amount
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result object with success status and amount
 */
async function getUserAvailablePayoutAmount(userId) {
  try {
    const { data, error } = await supabase
      .from('profits')
      .select('amount, fees, shipping_cost')
      .eq('user_id', userId)
      .eq('status', 'completed');
    
    if (error) {
      console.error('Error fetching user profits:', error);
      return { success: false, message: 'Failed to fetch user profits' };
    }

    // Calculate total profit
    const totalProfit = data.reduce((total, profit) => {
      const feesAmount = profit.fees || 0;
      const shippingAmount = profit.shipping_cost || 0;
      return total + (profit.amount - feesAmount - shippingAmount);
    }, 0);

    // Get total amount already paid out
    const { data: payouts, error: payoutsError } = await supabase
      .from('payout_requests')
      .select('amount')
      .eq('user_id', userId)
      .in('status', ['completed', 'pending']);
    
    if (payoutsError) {
      console.error('Error fetching user payouts:', payoutsError);
      return { success: false, message: 'Failed to fetch user payouts' };
    }

    const totalPaidOut = payouts.reduce((total, payout) => total + payout.amount, 0);
    
    // Available amount is total profit minus what's already been paid out
    const availableAmount = totalProfit - totalPaidOut;
    
    return { 
      success: true, 
      amount: availableAmount
    };
  } catch (error) {
    console.error('Error in getUserAvailablePayoutAmount:', error);
    return { success: false, message: `Server error: ${error.message}` };
  }
}

/**
 * Create a new payout request
 * @param {Object} payoutData - Payout request data
 * @returns {Promise<Object>} Result object with success status and payout data
 */
async function createPayoutRequest(payoutData) {
  try {
    const { user_id, amount, phone } = payoutData;
    
    // First check if user has enough available funds
    const availableResult = await getUserAvailablePayoutAmount(user_id);
    
    if (!availableResult.success) {
      return availableResult;
    }
    
    if (availableResult.amount < 50) {
      return { 
        success: false, 
        message: 'Minimum payout amount is $50.00'
      };
    }

    if (availableResult.amount < amount) {
      return { 
        success: false, 
        message: `Requested amount exceeds available balance. Available: $${availableResult.amount.toFixed(2)}`
      };
    }
    
    // Create the payout request
    const { data, error } = await supabase
      .from('payout_requests')
      .insert([{
        user_id,
        amount,
        phone,
        status: 'pending'
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating payout request:', error);
      return { success: false, message: 'Failed to create payout request' };
    }
    
    return { success: true, payout: data };
  } catch (error) {
    console.error('Error in createPayoutRequest:', error);
    return { success: false, message: `Server error: ${error.message}` };
  }
}

/**
 * Get payout requests for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result object with success status and payout requests
 */
async function getUserPayouts(userId) {
  try {
    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching user payouts:', error);
      return { success: false, message: 'Failed to fetch payout requests' };
    }
    
    return { success: true, payouts: data };
  } catch (error) {
    console.error('Error in getUserPayouts:', error);
    return { success: false, message: `Server error: ${error.message}` };
  }
}

/**
 * Update a payout request status
 * @param {string} payoutId - Payout request ID
 * @param {string} status - New status (completed/rejected)
 * @param {string} notes - Optional notes about the payout
 * @returns {Promise<Object>} Result object with success status
 */
async function updatePayoutStatus(payoutId, status, notes = '') {
  try {
    const updateData = {
      status,
      notes
    };
    
    // If marking as completed, set the completed_at timestamp
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('payout_requests')
      .update(updateData)
      .eq('id', payoutId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating payout status:', error);
      return { success: false, message: 'Failed to update payout status' };
    }
    
    return { success: true, payout: data };
  } catch (error) {
    console.error('Error in updatePayoutStatus:', error);
    return { success: false, message: `Server error: ${error.message}` };
  }
}

module.exports = {
  getUserAvailablePayoutAmount,
  createPayoutRequest,
  getUserPayouts,
  updatePayoutStatus
};
