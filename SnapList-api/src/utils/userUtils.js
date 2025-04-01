const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new user
 * @param {Object} userData - User data (name, birthday, phone, zelle_id)
 * @returns {Promise<Object>} - The created user
 */
async function createUser(userData) {
  try {
    // Validate required fields
    if (!userData.name || !userData.birthday || !userData.phone) {
      return { success: false, message: 'Missing required user fields' };
    }
    
    // Validate age (must be at least 13)
    const birthDate = new Date(userData.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 13) {
      return { success: false, message: 'User must be at least 13 years old' };
    }
    
    // Create user in database
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name: userData.name,
        birthday: userData.birthday,
        phone: userData.phone,
        zelle_id: userData.zelle_id || userData.phone, // Default to phone if zelle_id not provided
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      return { success: false, message: `Failed to create user: ${error.message}` };
    }
    
    return { success: true, user };
  } catch (error) {
    console.error('Error in createUser:', error);
    return { success: false, message: `User creation failed: ${error.message}` };
  }
}

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

/**
 * Get user statistics
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The user statistics
 */
async function getUserStats(userId) {
  try {
    // Get listings count
    const { data: listingsData, error: listingsError } = await supabase
      .from('listings')
      .select('status, price, original_price')
      .eq('user_id', userId);
    
    if (listingsError) {
      console.error(`Error fetching listings for user ${userId}:`, listingsError);
      return { success: false, message: `Failed to fetch user statistics: ${listingsError.message}` };
    }
    
    // Get profits
    const { data: profitsData, error: profitsError } = await supabase
      .from('profits')
      .select('status, amount, platform')
      .eq('user_id', userId);
    
    if (profitsError) {
      console.error(`Error fetching profits for user ${userId}:`, profitsError);
      return { success: false, message: `Failed to fetch user statistics: ${profitsError.message}` };
    }
    
    // Calculate statistics
    const stats = {
      listings: {
        total: listingsData.length,
        active: listingsData.filter(listing => listing.status === 'active').length,
        sold: listingsData.filter(listing => listing.status === 'sold').length,
        ended: listingsData.filter(listing => listing.status === 'ended').length
      },
      profits: {
        total: profitsData.reduce((sum, profit) => sum + parseFloat(profit.amount), 0),
        pending: profitsData
          .filter(profit => profit.status === 'pending')
          .reduce((sum, profit) => sum + parseFloat(profit.amount), 0),
        completed: profitsData
          .filter(profit => profit.status === 'completed')
          .reduce((sum, profit) => sum + parseFloat(profit.amount), 0),
        byPlatform: {
          ebay: profitsData
            .filter(profit => profit.platform === 'ebay')
            .reduce((sum, profit) => sum + parseFloat(profit.amount), 0),
          facebook: profitsData
            .filter(profit => profit.platform === 'facebook')
            .reduce((sum, profit) => sum + parseFloat(profit.amount), 0)
        }
      }
    };
    
    return { success: true, stats };
  } catch (error) {
    console.error(`Error in getUserStats:`, error);
    return { success: false, message: `Failed to fetch user statistics: ${error.message}` };
  }
}

module.exports = {
  createUser,
  getUserById,
  updateUser,
  getUserStats
}; 