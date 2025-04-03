const express = require('express');
const userUtils = require('../utils/userUtils');
const notificationService = require('../services/notificationService');
const { Configuration, OpenAIApi } = require("openai");
const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Configure OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

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
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  // Ensure the requesting user is authorized to access this user
  if (req.user.id !== id && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized access to user data' 
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    return res.status(200).json({ success: true, user: data });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching user' 
    });
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
router.post('/:id/chat/support', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { message, conversation_id } = req.body;
  
  // Validate input
  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Message is required'
    });
  }
  
  // Ensure the requesting user is authorized
  if (req.user.id !== id) {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized access' 
    });
  }
  
  try {
    // Get user data to personalize response
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name')
      .eq('id', id)
      .single();
      
    if (userError) throw userError;
    
    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // System prompt with app functionality information
    const systemPrompt = `You are an AI assistant for the SnapList app, a marketplace for sneakers. 
    
    App functionalities:
    - Users can list sneakers for sale with photos, prices, and descriptions
    - Users can browse and buy sneakers from other users
    - Payments are processed through the app with Zelle integration
    - Sellers receive payments after buyers confirm receipt of items
    
    Terms of Service summary:
    - Users must be 18+ to sell on the platform
    - No counterfeit or replica items allowed
    - Sellers must ship items within 3 days of purchase
    - Payment processing fee of 5% applies to all sales
    
    Privacy Policy summary:
    - We collect user information including name, email, and payment details
    - User data is never sold to third parties
    - Location data is only used to show nearby listings
    
    Common FAQs:
    - Shipping: Sellers are responsible for shipping costs unless otherwise stated
    - Returns: The app does not handle returns directly; buyers and sellers must communicate
    - Account issues: Users should contact support for account-related problems
    - Payment issues: Payment disputes should be reported within 7 days of transaction
    
    Be helpful, friendly, and concise. If you don't know an answer, suggest contacting the support team directly. Address the user by their name when appropriate.`;
    
    // Get AI response
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500
    });
    
    const aiResponse = completion.data.choices[0].message.content;
    
    // Store in database based on whether this is a new conversation or part of an existing one
    let responseObj;
    
    if (conversation_id) {
      // Add to existing conversation
      responseObj = await addToExistingConversation(id, conversation_id, message, aiResponse);
    } else {
      // Create a new conversation
      responseObj = await createNewConversation(id, message, aiResponse);
    }
    
    return res.status(200).json({
      success: true,
      response: aiResponse,
      conversationId: responseObj.conversationId,
      messageId: responseObj.messageId
    });
    
  } catch (error) {
    console.error('Support chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing support request'
    });
  }
});

// Helper function to create a new conversation
async function createNewConversation(userId, message, aiResponse) {
  // Generate IDs
  const conversationId = uuidv4();
  const messageId = uuidv4();
  
  // Create message array with user message and AI response
  const messages = [
    {
      id: messageId,
      type: 'user',
      content: message,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      type: 'ai',
      content: aiResponse,
      created_at: new Date().toISOString()
    }
  ];
  
  // Create the conversation record
  const { data, error } = await supabase
    .from('support_conversations')
    .insert({
      id: conversationId,
      user_id: userId,
      title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
      messages: messages,
      status: 'pending',
      last_message_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    conversationId,
    messageId
  };
}

// Helper function to add to an existing conversation
async function addToExistingConversation(userId, conversationId, message, aiResponse) {
  // First check if the conversation exists and belongs to this user
  const { data: conversation, error: fetchError } = await supabase
    .from('support_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();
  
  if (fetchError) throw fetchError;
  
  if (!conversation) {
    throw new Error('Conversation not found or does not belong to this user');
  }
  
  // Generate message IDs
  const messageId = uuidv4();
  
  // Create new messages
  const userMessage = {
    id: messageId,
    type: 'user',
    content: message,
    created_at: new Date().toISOString()
  };
  
  const aiMessage = {
    id: uuidv4(),
    type: 'ai',
    content: aiResponse,
    created_at: new Date().toISOString()
  };
  
  // Update the conversation
  const { data, error } = await supabase
    .from('support_conversations')
    .update({
      messages: [...conversation.messages, userMessage, aiMessage],
      last_message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      last_message_at: new Date().toISOString(),
      status: 'pending', // Reset to pending since there's a new message
    })
    .eq('id', conversationId)
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    conversationId,
    messageId
  };
}

/**
 * @route GET /api/users/:id/chat/support/history
 * @desc Get user's support chat history
 * @access Public
 */
router.get('/:id/chat/support/history', requireAuth, async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 20;
  
  // Ensure the requesting user is authorized
  if (req.user.id !== id) {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized access' 
    });
  }
  
  try {
    // Get conversations ordered by last message time
    const { data, error } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('user_id', id)
      .order('last_message_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    // Format conversations for the client
    const formattedConversations = data.map(conv => {
      return {
        id: conv.id,
        title: conv.title,
        last_message: getMessage(conv.messages),
        last_message_at: conv.last_message_at,
        status: conv.status,
        unread: isUnread(conv),
        has_admin_response: hasAdminResponse(conv.messages)
      };
    });
    
    return res.status(200).json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    console.error('Error fetching support chat history:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching support chat history'
    });
  }
});

// Get conversation messages
router.get('/:id/chat/support/conversations/:conversationId', requireAuth, async (req, res) => {
  const { id, conversationId } = req.params;
  
  // Ensure the requesting user is authorized
  if (req.user.id !== id) {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized access' 
    });
  }
  
  try {
    // Fetch the conversation
    const { data, error } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', id)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    // Format messages for client
    const messages = formatMessagesForClient(data.messages, data.hide_ai_responses);
    
    return res.status(200).json({
      success: true,
      conversation: {
        id: data.id,
        title: data.title,
        status: data.status,
        messages: messages,
        hide_ai_responses: data.hide_ai_responses
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching conversation'
    });
  }
});

// Mark conversation as read
router.post('/:id/chat/support/conversations/:conversationId/read', requireAuth, async (req, res) => {
  const { id, conversationId } = req.params;
  
  // Ensure the requesting user is authorized
  if (req.user.id !== id) {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized access' 
    });
  }
  
  try {
    // Update the read_at timestamp
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('support_conversations')
      .update({ read_at: now })
      .eq('id', conversationId)
      .eq('user_id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error marking conversation as read'
    });
  }
});

// Helper functions for support chats
function getMessage(messages) {
  if (!messages || messages.length === 0) {
    return "";
  }
  // Get the most recent non-system message
  const userMessages = messages.filter(m => m.type === 'user');
  if (userMessages.length > 0) {
    const lastMessage = userMessages[userMessages.length - 1];
    return lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : '');
  }
  return "";
}

function isUnread(conversation) {
  if (!conversation.read_at) return true;
  
  // Check if there are admin messages after the read_at time
  const readTime = new Date(conversation.read_at).getTime();
  
  // Find any admin messages that were created after read_at
  const unreadAdminMessages = conversation.messages.filter(msg => {
    return msg.type === 'admin' && new Date(msg.created_at).getTime() > readTime;
  });
  
  return unreadAdminMessages.length > 0;
}

function hasAdminResponse(messages) {
  if (!messages) return false;
  return messages.some(msg => msg.type === 'admin');
}

function formatMessagesForClient(messages, hideAi) {
  if (!messages) return [];
  
  // Filter out AI messages if they should be hidden
  return messages.filter(msg => {
    return !(hideAi && msg.type === 'ai');
  });
}

module.exports = router; 