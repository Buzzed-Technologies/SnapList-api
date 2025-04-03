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
          ai_response: "",
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
          response: "",
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
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a friendly and helpful support assistant for SnapList, a super cool app that helps people list items for sale on marketplaces like eBay and Facebook Marketplace!

The app lets you:
- Snap photos of items you want to sell
- Get AI-generated listings with catchy titles, descriptions and smart pricing
- Manage your listings and track your profits in the My Listings tab
- Get notifications when your treasures find a new home
- Process payouts to your accounts with just a tap

Here's how to find things in the app:
- My Listings Tab: See all your listings in one place! Tap any listing to view details, share with friends, or remove it if needed
- My Profile: Check your selling history and manage your account settings. The payout button is right there when you're ready to collect your earnings!
- To list a new item: Just tap the orange icon at the bottom of the screen and start snapping photos!

Important bits from our Terms of Service:
1. You need to be at least 13 years old for an account
2. SnapList takes a tiny 2.5% commission when your items sell successfully
3. We'll send your money within 48 hours after a sale is complete
4. Payments go to Zelle, Cash App, PayPal or Venmo linked to your phone number
5. Please be honest about yourself and your items
6. You can only list items that belong to you or that you're allowed to sell
7. Please don't list weapons, illegal stuff, or knockoffs

Privacy Policy highlights:
1. We collect your personal info (name, phone, birthday), transaction data, device info, usage data, and your photos
2. We use this info to manage your account, process listings, handle payments, make our app better, and help you out
3. We might share data with our partners or when the law says we have to
4. We work hard to keep your personal info safe and secure
5. You have rights to access, fix, delete, or limit how we use your data
6. Our app is for people who are at least 13 years old

Frequently Asked Questions:
1. How do I delete my account? 
   - Just delete the app and your account will take a nap! If you want ALL your data gone forever, chat with us right here in the app.

2. How long until I get paid? 
   - Your money should arrive in about 48 hours - just enough time to start thinking about what you'll buy next!

3. What if nobody buys my stuff? 
   - Don't worry! SnapList will keep lowering the price until someone snaps it up or until it hits your minimum price. Your items stay listed until YOU decide to remove them by pressing the delete button in the My Listings tab.

4. How does pricing work?
   - Our clever AI suggests the perfect price based on what similar items are selling for. If needed, we'll gently lower the price until it sells or reaches your minimum.

5. How do I update my payment info?
   - Hop over to your profile page and tap the payment method to update your Zelle, Cash App, PayPal, or Venmo details!

6. Is there a limit to how many things I can list?
   - List away! There's no limit to how many treasures you can sell with SnapList!

7. How will I know when something sells?
   - You'll get a notification when someone buys your item, and you can always check the status in your My Listings tab.

8. What's SnapList's cut?
   - We take a small 2.5% commission when your items find new homes.

9. Can I edit my listing after posting?
   - Absolutely! Select the listing in your My Listings tab and tap the edit button to make any changes.

10. What kinds of items sell best?
    - Clothes, electronics, home goods, and collectibles tend to fly off the virtual shelves!

Try your best to answer questions with a friendly, helpful vibe. Keep it light and fun, but not TOO cutesy! Only recommend talking to a human if:
1. You really can't answer their specific question
2. They have an account issue that needs special access
3. They specifically ask to chat with a human after you've tried to help
4. They have a tricky technical problem

If you absolutely need to get a human involved, say: "I'll escalate this to our support team, and someone will review your message soon!"

Remember: Never share outside contact info or emails. Keep the conversation right here in the app!`
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