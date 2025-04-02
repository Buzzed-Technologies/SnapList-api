const { supabase } = require('../config/supabase');

/**
 * Get a user by ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The user data
 */
async function getUserById(userId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return { success: false, message: `Failed to fetch user: ${error.message}` };
    }
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    return { success: true, user };
  } catch (error) {
    console.error(`Error in getUserById:`, error);
    return { success: false, message: `Failed to fetch user: ${error.message}` };
  }
}

/**
 * Update a user
 * @param {string} userId - The user ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object>} - The updated user
 */
async function updateUser(userId, updateData) {
  try {
    const updates = {};
    
    // Only allow updating certain fields
    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.phone !== undefined) updates.phone = updateData.phone;
    if (updateData.zelle_id !== undefined) updates.zelle_id = updateData.zelle_id;
    if (updateData.paypal_id !== undefined) updates.paypal_id = updateData.paypal_id;
    if (updateData.venmo_id !== undefined) updates.venmo_id = updateData.venmo_id;
    if (updateData.cashapp_id !== undefined) updates.cashapp_id = updateData.cashapp_id;
    
    // Don't allow updating birthday (age verification)
    
    if (Object.keys(updates).length === 0) {
      return { success: false, message: 'No valid fields to update' };
    }
    
    updates.updated_at = new Date().toISOString();
    
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.error(`Error updating user ${userId}:`, error);
      return { success: false, message: `Failed to update user: ${error.message}` };
    }
    
    return { success: true, user: updatedUser };
  } catch (error) {
    console.error(`Error in updateUser:`, error);
    return { success: false, message: `Failed to update user: ${error.message}` };
  }
}

module.exports = {
  getUserById,
  updateUser
}; 