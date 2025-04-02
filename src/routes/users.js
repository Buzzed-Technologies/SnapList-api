const express = require('express');
const userUtils = require('../utils/userUtils');
const notificationService = require('../services/notificationService');
const openai = require('../config/openai');

const router = express.Router();

/**
 * @route POST /api/users
 * @desc Create a new user
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const { name, birthday, phone, zelle_id } = req.body;
    
    // Create the user
    const result = await userUtils.createUser({
      name,
      birthday,
      phone,
      zelle_id
    });
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(201).json({
      success: true,
      user: result.user
    });
  } catch (error) {
    console.error('Error in POST /users:', error);
    res.status(500).json({ success: false, message: `Failed to create user: ${error.message}` });
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get a user by ID
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await userUtils.getUserById(id);
    
    if (!result.success) {
      return res.status(404).json({ success: false, message: result.message });
    }
    
    res.status(200).json({
      success: true,
      user: result.user
    });
  } catch (error) {
    console.error(`Error in GET /users/${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to fetch user: ${error.message}` });
  }
});

/**
 * @route PUT /api/users/:id
 * @desc Update a user
 * @access Public
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, zelle_id } = req.body;
    
    const result = await userUtils.updateUser(id, {
      name,
      phone,
      zelle_id
    });
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(200).json({
      success: true,
      user: result.user
    });
  } catch (error) {
    console.error(`Error in PUT /users/${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to update user: ${error.message}` });
  }
});

/**
 * @route GET /api/users/:id/stats
 * @desc Get user statistics
 * @access Public
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await userUtils.getUserStats(id);
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(200).json({
      success: true,
      stats: result.stats
    });
  } catch (error) {
    console.error(`Error in GET /users/${req.params.id}/stats:`, error);
    res.status(500).json({ success: false, message: `Failed to fetch user statistics: ${error.message}` });
  }
});

/**
 * @route GET /api/users/:id/notifications
 * @desc Get user notifications
 * @access Public
 */
router.get('/:id/notifications', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = 20, offset = 0 } = req.query;
    
    const result = await notificationService.getUserNotifications(id, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(200).json({
      success: true,
      notifications: result.notifications,
      count: result.count
    });
  } catch (error) {
    console.error(`Error in GET /users/${req.params.id}/notifications:`, error);
    res.status(500).json({ success: false, message: `Failed to fetch user notifications: ${error.message}` });
  }
});

/**
 * @route POST /api/users/:id/notifications/read
 * @desc Mark all notifications as read
 * @access Public
 */
router.post('/:id/notifications/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await notificationService.markAllNotificationsRead(id);
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error(`Error in POST /users/${req.params.id}/notifications/read:`, error);
    res.status(500).json({ success: false, message: `Failed to mark notifications as read: ${error.message}` });
  }
});

/**
 * @route POST /api/users/:id/chat/support
 * @desc Process a support chat message and get AI response
 * @access Public
 */
router.post('/:id/chat/support', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    
    // Get the user to provide context
    const userResult = await userUtils.getUserById(id);
    
    if (!userResult.success) {
      return res.status(404).json({ success: false, message: userResult.message });
    }
    
    // Process the message with OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a helpful support assistant for SnapList, an app that helps people list items for sale on marketplaces like eBay and Facebook Marketplace.
          
The app allows users to:
- Take photos of items they want to sell
- Get AI-generated listings with titles, descriptions and pricing
- Manage their listings and track profits
- Get notifications when items sell
- Process payouts to their accounts

If you cannot answer a user's question or they have a specific issue that requires human attention, provide the support email: buzedapp@gmail.com.

Keep responses concise, helpful, and focused on helping the user understand how to use the app.`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 500
    });
    
    const aiResponse = response.choices[0].message.content;
    
    res.status(200).json({
      success: true,
      response: aiResponse
    });
  } catch (error) {
    console.error(`Error in POST /users/${req.params.id}/chat/support:`, error);
    res.status(500).json({ success: false, message: `Failed to process support chat: ${error.message}` });
  }
});

module.exports = router; 