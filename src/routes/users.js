const express = require('express');
const userUtils = require('../utils/userUtils');
const notificationService = require('../services/notificationService');
const openai = require('../config/openai');
const { supabase } = require('../config/supabase');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');

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
    const { message, conversation_id } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    
    // Get the user to provide context
    const userResult = await userUtils.getUserById(id);
    
    if (!userResult.success) {
      return res.status(404).json({ success: false, message: userResult.message });
    }
    
    // If conversation_id is provided, check if the conversation is already escalated
    let isAlreadyEscalated = false;
    if (conversation_id) {
      const { data: existingConversation, error: checkError } = await supabase
        .from('support_chats')
        .select('status')
        .eq('conversation_id', conversation_id)
        .eq('status', 'escalated')
        .limit(1);
      
      if (!checkError && existingConversation && existingConversation.length > 0) {
        isAlreadyEscalated = true;
        
        // This conversation is already escalated, no AI response should be generated
        // Store the message only for admin viewing
        const insertData = {
          user_id: id,
          message,
          status: 'escalated',
          conversation_id: conversation_id
        };
        
        // Store the support chat in the database
        const { data: chatData, error: chatError } = await supabase
          .from('support_chats')
          .insert(insertData)
          .select();
          
        if (chatError) {
          console.error('Error storing escalated support chat:', chatError);
          return res.status(500).json({ success: false, message: 'Failed to store chat message' });
        }
        
        // Return success with no AI response since this is now waiting for admin
        return res.status(200).json({
          success: true,
          chatId: chatData[0].id,
          conversationId: chatData[0].conversation_id,
          escalated: true,
          waitingForAdmin: true
        });
      }
    }
    
    // If we need to generate AI response
    if (!isAlreadyEscalated) {
      // Check if user is directly asking for a human/agent
      const requestsHumanPatterns = [
        /speak (with|to) (a|an) (human|agent|person|representative)/i,
        /talk (with|to) (a|an) (human|agent|person|representative)/i,
        /connect (with|to) (a|an) (human|agent|person|representative)/i,
        /real person/i,
        /human support/i,
        /live agent/i,
        /escalate/i
      ];
      
      const isRequestingHuman = requestsHumanPatterns.some(pattern => pattern.test(message));
      
      let aiResponse;
      let needsEscalation = false;
      
      if (isRequestingHuman) {
        // Ask why they need a human agent first
        aiResponse = "I'd be happy to connect you with a human agent. To help us route your request properly, could you please tell me what specific issue you're trying to resolve? I might be able to help you directly.";
      } else {
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

Here are important details from our Terms of Service:
1. Users must be at least 13 years old to create an account
2. SnapList charges a 2.5% commission on successful transactions
3. Payouts are typically processed within 48 hours after a transaction is complete
4. Payments are made to Zelle, Cash App, PayPal or Venmo linked phone numbers
5. Users must provide accurate information about themselves and their listings
6. Users can only list items they own or have authorization to sell
7. Prohibited items include weapons, illegal substances, and counterfeit goods

Here are important details from our Privacy Policy:
1. We collect personal information (name, phone number, date of birth), transaction data, device information, usage data, and photos/media
2. We use this information to manage accounts, process listings/transactions, facilitate payments, improve services, and provide support
3. We may share data with service providers, business partners, or when required by law
4. We implement security measures to protect personal information
5. Users have rights to access, correct, delete, or restrict processing of their data
6. The app is intended for users who are at least 13 years old

Frequently Asked Questions:
1. How do I delete my account? 
   - Delete the app and your account will be inactivated. If you want all data deleted, contact support through the app.

2. How long does it take for payment to process? 
   - Payments typically process within around 48 hours.

3. What if my items don't get sold? 
   - SnapList will keep lowering the price until items are sold or until they reach the minimum price. Items will never be delisted unless you press the delete listing button in the app.

4. How does pricing work?
   - Our AI automatically suggests an optimal price for your item based on market data. We'll gradually reduce the price if needed until it sells or reaches your minimum price.

5. How do I update my payment information?
   - Go to your profile page and tap the payment method to update your Zelle, Cash App, PayPal, or Venmo information.

6. Is there a limit to how many items I can list?
   - There is no limit to the number of items you can list with SnapList.

7. How do I know when my item sells?
   - You'll receive a notification when your item sells, and you can also check the status in your listings tab.

8. What commission does SnapList take?
   - SnapList charges a 2.5% commission on successful sales.

9. Can I edit my listing after posting?
   - Yes, you can edit your listing details by selecting the listing and tapping the edit button.

10. What types of items sell best on SnapList?
    - Clothing, electronics, home goods, and collectibles typically sell well on our platform.

Try your best to answer the user's question. Be helpful, friendly and concise. Only recommend escalation to human support if:
1. You genuinely cannot answer their specific question or solve their problem
2. Their issue involves account-specific issues that need admin access
3. They explicitly ask to speak to a human agent after you've tried to help
4. They need technical support for a complex issue

If escalation is absolutely necessary, include this in your response: "I'll escalate this to our support team, and someone will review your message soon."

Important: Never provide external contact information or emails. Keep users in the app for support.`
            },
            {
              role: "user",
              content: message
            }
          ],
          max_tokens: 500
        });
        
        aiResponse = response.choices[0].message.content;
        
        // Check if this message needs to be escalated to admin support
        // Look for phrases indicating escalation in the AI response
        const escalationPhrases = [
          "I'll escalate this to our support team",
          "someone will review your message",
          "escalate this to our team",
          "requires human attention",
          "I'll escalate this"
        ];
        
        needsEscalation = escalationPhrases.some(phrase => aiResponse.includes(phrase));
      }
      
      // Check if we need to create a new conversation or add to existing one
      let insertData = {
        user_id: id,
        message,
        ai_response: aiResponse,
        status: needsEscalation ? 'escalated' : 'pending' 
      };
      
      // If conversation_id is provided, add to that conversation
      if (conversation_id) {
        // Verify the conversation belongs to this user
        const { data: existingConversation, error: verifyError } = await supabase
          .from('support_chats')
          .select('id')
          .eq('conversation_id', conversation_id)
          .eq('user_id', id)
          .limit(1);
        
        if (verifyError || !existingConversation || existingConversation.length === 0) {
          // Invalid conversation ID, create new one
          const { data: newUUID } = await supabase.rpc('gen_random_uuid');
          insertData.conversation_id = newUUID || crypto.randomUUID();
        } else {
          // Valid conversation ID, use it
          insertData.conversation_id = conversation_id;
        }
      } else {
        // Generate a new UUID for conversation_id - use node's crypto if RPC fails
        const { data: newUUID, error: uuidError } = await supabase.rpc('gen_random_uuid');
        insertData.conversation_id = newUUID || crypto.randomUUID();
      }
      
      // Store the support chat in the database
      const { data: chatData, error: chatError } = await supabase
        .from('support_chats')
        .insert(insertData)
        .select();
        
      if (chatError) {
        console.error('Error storing support chat:', chatError);
        // Continue anyway to return the AI response to the user
      }
      
      // If escalation is needed, update all messages in the conversation
      if (needsEscalation && insertData.conversation_id) {
        const { error: conversationUpdateError } = await supabase
          .from('support_chats')
          .update({ 
            status: 'escalated',
            updated_at: new Date().toISOString()
          })
          .eq('conversation_id', insertData.conversation_id);
        
        if (conversationUpdateError) {
          console.error('Error updating conversation status to escalated:', conversationUpdateError);
        } else {
          console.log(`Successfully escalated conversation ${insertData.conversation_id} to admin support`);
        }
      }
      
      res.status(200).json({
        success: true,
        response: aiResponse,
        chatId: chatData && chatData.length > 0 ? chatData[0].id : null,
        conversationId: chatData && chatData.length > 0 ? chatData[0].conversation_id : insertData.conversation_id,
        escalated: needsEscalation
      });
    }
  } catch (error) {
    console.error(`Error in POST /users/${req.params.id}/chat/support:`, error);
    res.status(500).json({ success: false, message: `Failed to process support chat: ${error.message}` });
  }
});

/**
 * @route GET /api/users/:id/chat/support/history
 * @desc Get user's support chat history grouped by conversations
 * @access Public
 */
router.get('/:id/chat/support/history', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    // Get the latest message from each conversation
    const { data: conversations, error: conversationsError } = await supabase
      .rpc('get_latest_conversations', { 
        user_id_param: id,
        limit_param: parseInt(limit)
      });
    
    if (conversationsError) {
      console.error(`Error fetching support chat conversations for user ${id}:`, conversationsError);
      
      // Fallback to older implementation if the function doesn't exist
      const { data: chats, error } = await supabase
        .from('support_chats')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));
      
      if (error) {
        return res.status(500).json({
          success: false,
          message: `Failed to fetch support chat history: ${error.message}`
        });
      }
      
      // Transform the chats data to include unread flag and ensure updated_at is not null
      const formattedChats = chats.map(chat => ({
        ...chat,
        updated_at: chat.updated_at || chat.created_at,
        unread: chat.admin_response && !chat.read_at
      }));
      
      return res.status(200).json({
        success: true,
        chats: formattedChats
      });
    }
    
    // Transform the conversations data
    const formattedConversations = conversations.map(chat => ({
      ...chat,
      updated_at: chat.updated_at || chat.created_at,
      unread: chat.admin_response && !chat.read_at
    }));
    
    res.status(200).json({
      success: true,
      chats: formattedConversations
    });
  } catch (error) {
    console.error(`Error in GET /users/${req.params.id}/chat/support/history:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch support chat history: ${error.message}`
    });
  }
});

/**
 * @route GET /api/users/:id/chat/support/conversations/:conversationId
 * @desc Get all messages in a specific conversation
 * @access Public
 */
router.get('/:id/chat/support/conversations/:conversationId', async (req, res) => {
  try {
    const { id, conversationId } = req.params;
    
    // Get all messages in this conversation
    const { data: messages, error } = await supabase
      .from('support_chats')
      .select('*')
      .eq('user_id', id)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error(`Error fetching conversation ${conversationId} for user ${id}:`, error);
      return res.status(500).json({
        success: false,
        message: `Failed to fetch conversation: ${error.message}`
      });
    }
    
    // Check if there are any unread messages and mark them as read
    const unreadMessages = messages.filter(msg => msg.admin_response && !msg.read_at);
    if (unreadMessages.length > 0) {
      const unreadIds = unreadMessages.map(msg => msg.id);
      
      const { error: markReadError } = await supabase
        .from('support_chats')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds);
      
      if (markReadError) {
        console.error(`Error marking messages as read in conversation ${conversationId}:`, markReadError);
      }
    }
    
    res.status(200).json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error(`Error in GET /users/${req.params.id}/chat/support/conversations/${req.params.conversationId}:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch conversation: ${error.message}`
    });
  }
});

module.exports = router; 