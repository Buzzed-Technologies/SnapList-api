const { supabase } = require('../config/supabase');

/**
 * Create a new notification
 * @param {Object} notification - The notification data
 * @returns {Promise<Object>} - The created notification
 */
async function createNotification(notification) {
  try {
    // Validate notification data
    if (!notification.user_id || !notification.message || !notification.type) {
      return { success: false, message: 'Missing required notification fields' };
    }
    
    // Ensure valid notification type
    if (!['price_reduction', 'item_sold'].includes(notification.type)) {
      return { success: false, message: 'Invalid notification type' };
    }
    
    // Insert notification into database
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.user_id,
        listing_id: notification.listing_id || null, 
        type: notification.type,
        message: notification.message,
        status: 'unread',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating notification:', error);
      return { success: false, message: `Failed to create notification: ${error.message}` };
    }
    
    return { success: true, notification: data };
  } catch (error) {
    console.error('Error in createNotification:', error);
    return { success: false, message: `Notification creation failed: ${error.message}` };
  }
}

/**
 * Get notifications for a user
 * @param {string} userId - The user ID
 * @param {Object} options - Query options (limit, offset, status)
 * @returns {Promise<Object>} - The user's notifications
 */
async function getUserNotifications(userId, options = {}) {
  try {
    // Set up query
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Filter by status if provided
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    // Add pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }
    
    // Execute query
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching notifications:', error);
      return { success: false, message: `Failed to fetch notifications: ${error.message}` };
    }
    
    return { 
      success: true, 
      notifications: data,
      count: data.length
    };
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    return { success: false, message: `Fetching notifications failed: ${error.message}` };
  }
}

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification ID
 * @returns {Promise<Object>} - The result
 */
async function markNotificationRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        status: 'read',
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId);
    
    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, message: `Failed to mark notification as read: ${error.message}` };
    }
    
    return { success: true, message: 'Notification marked as read' };
  } catch (error) {
    console.error('Error in markNotificationRead:', error);
    return { success: false, message: `Marking notification as read failed: ${error.message}` };
  }
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The result
 */
async function markAllNotificationsRead(userId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        status: 'read',
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'unread');
    
    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, message: `Failed to mark all notifications as read: ${error.message}` };
    }
    
    return { success: true, message: 'All notifications marked as read' };
  } catch (error) {
    console.error('Error in markAllNotificationsRead:', error);
    return { success: false, message: `Marking all notifications as read failed: ${error.message}` };
  }
}

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @returns {Promise<Object>} - The result
 */
async function deleteNotification(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    
    if (error) {
      console.error('Error deleting notification:', error);
      return { success: false, message: `Failed to delete notification: ${error.message}` };
    }
    
    return { success: true, message: 'Notification deleted' };
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    return { success: false, message: `Deleting notification failed: ${error.message}` };
  }
}

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification
}; 