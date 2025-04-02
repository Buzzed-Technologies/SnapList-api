const express = require('express');
const { supabase } = require('../config/supabase');
const ebayService = require('../services/ebayService');
const facebookService = require('../services/facebookService');
const priceService = require('../services/priceService');
const notificationService = require('../services/notificationService');

const router = express.Router();

/**
 * @route GET /api/listings
 * @desc Get all listings for a user
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { user_id, status, limit = 20, offset = 0 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    let query = supabase
      .from('listings')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error, count } = await query
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (error) {
      console.error('Error fetching listings:', error);
      return res.status(500).json({ success: false, message: `Failed to fetch listings: ${error.message}` });
    }
    
    res.status(200).json({
      success: true,
      listings: data,
      count: data.length
    });
  } catch (error) {
    console.error('Error in GET /listings:', error);
    res.status(500).json({ success: false, message: `Failed to fetch listings: ${error.message}` });
  }
});

/**
 * @route GET /api/listings/:id
 * @desc Get a specific listing
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: listing, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error(`Error fetching listing ${id}:`, error);
      return res.status(500).json({ success: false, message: `Failed to fetch listing: ${error.message}` });
    }
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Fetch price history for this listing
    const { data: priceHistory, error: priceHistoryError } = await supabase
      .from('price_history')
      .select('*')
      .eq('listing_id', id)
      .order('created_at', { ascending: false });
    
    if (priceHistoryError) {
      console.error(`Error fetching price history for listing ${id}:`, priceHistoryError);
    }
    
    res.status(200).json({
      success: true,
      listing,
      priceHistory: priceHistory || []
    });
  } catch (error) {
    console.error(`Error in GET /listings/${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to fetch listing: ${error.message}` });
  }
});

/**
 * @route POST /api/listings
 * @desc Create a new listing
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const { 
      user_id, 
      title, 
      description, 
      price, 
      image_urls,
      platform,
      condition,
      category,
      brand,
      size,
      color,
      min_price
    } = req.body;
    
    // Validate required fields
    if (!user_id || !title || !description || !price || !image_urls || !image_urls.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: user_id, title, description, price, and image_urls are required' 
      });
    }
    
    // Validate user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single();
    
    if (userError || !user) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    // Calculate minimum price (50% of original) if not provided
    const originalPrice = parseFloat(price);
    const calculatedMinPrice = min_price !== undefined ? parseFloat(min_price) : Math.round((originalPrice * 0.5) * 100) / 100;
    
    // Create the listing in our database first
    const { data: listing, error } = await supabase
      .from('listings')
      .insert({
        user_id,
        title,
        description,
        price: originalPrice,
        original_price: originalPrice,
        min_price: calculatedMinPrice,
        image_urls,
        status: 'active',
        condition: condition || 'Used - Good',
        category: category || null,
        brand: brand || null,
        size: size || null,
        color: color || null,
        platform: platform || 'both', // Default to both if not specified
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_price_update: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating listing:', error);
      return res.status(500).json({ success: false, message: `Failed to create listing: ${error.message}` });
    }
    
    // Always post to both platforms if platform is 'both' or not specified
    const shouldPostToEbay = platform === 'both' || platform === 'eBay' || !platform;
    const shouldPostToFacebook = platform === 'both' || platform === 'Facebook Marketplace' || !platform;
    
    // Create listing on eBay if applicable
    let ebayResult = { success: false, message: 'eBay posting skipped' };
    if (shouldPostToEbay) {
      ebayResult = await ebayService.createEbayListing(listing, image_urls);
    }
    
    // Create listing on Facebook Marketplace if applicable
    let facebookResult = { success: false, message: 'Facebook posting skipped' };
    if (shouldPostToFacebook) {
      facebookResult = await facebookService.createFacebookListing(listing, image_urls);
    }
    
    // Update our listing with marketplace IDs
    const updates = {};
    
    if (ebayResult.success && ebayResult.ebayItemId) {
      updates.ebay_listing_id = ebayResult.ebayItemId;
    }
    
    if (facebookResult.success && facebookResult.fbListingId) {
      updates.facebook_listing_id = facebookResult.fbListingId;
    }
    
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', listing.id);
      
      if (updateError) {
        console.error('Error updating listing with marketplace IDs:', updateError);
      }
    }
    
    res.status(201).json({
      success: true,
      listing: {
        ...listing,
        ...updates
      },
      marketplace: {
        ebay: ebayResult,
        facebook: facebookResult
      }
    });
  } catch (error) {
    console.error('Error in POST /listings:', error);
    res.status(500).json({ success: false, message: `Failed to create listing: ${error.message}` });
  }
});

/**
 * @route PUT /api/listings/:id
 * @desc Update a listing
 * @access Public
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, status, min_price } = req.body;
    
    // Fetch the current listing
    const { data: existingListing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingListing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Prepare updates
    const updates = {};
    
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (min_price !== undefined) updates.min_price = min_price;
    
    // Handle price updates separately to track history
    if (price !== undefined && price !== existingListing.price) {
      const priceUpdateResult = await priceService.updateListingPrice(id, parseFloat(price));
      
      if (!priceUpdateResult.success) {
        return res.status(500).json({ 
          success: false, 
          message: `Failed to update price: ${priceUpdateResult.message}` 
        });
      }
    }
    
    // If there are updates other than price
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', id);
      
      if (updateError) {
        return res.status(500).json({ 
          success: false, 
          message: `Failed to update listing: ${updateError.message}` 
        });
      }
      
      // Update on marketplaces
      if (existingListing.ebay_listing_id) {
        const ebayUpdateData = {};
        if (updates.title) ebayUpdateData.Title = updates.title;
        if (updates.description) ebayUpdateData.Description = updates.description;
        
        if (Object.keys(ebayUpdateData).length > 0) {
          await ebayService.updateEbayListing(existingListing.ebay_listing_id, ebayUpdateData);
        }
        
        if (updates.status === 'ended') {
          await ebayService.endEbayListing(existingListing.ebay_listing_id);
        }
      }
      
      if (existingListing.facebook_listing_id) {
        const fbUpdateData = {};
        if (updates.title) fbUpdateData.name = updates.title;
        if (updates.description) fbUpdateData.description = updates.description;
        
        if (Object.keys(fbUpdateData).length > 0) {
          await facebookService.updateFacebookListing(existingListing.facebook_listing_id, fbUpdateData);
        }
        
        if (updates.status === 'ended') {
          await facebookService.endFacebookListing(existingListing.facebook_listing_id);
        }
      }
    }
    
    // Get the updated listing
    const { data: updatedListing, error: refetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (refetchError) {
      return res.status(500).json({ 
        success: false, 
        message: `Failed to fetch updated listing: ${refetchError.message}` 
      });
    }
    
    res.status(200).json({
      success: true,
      listing: updatedListing
    });
  } catch (error) {
    console.error(`Error in PUT /listings/${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to update listing: ${error.message}` });
  }
});

/**
 * @route DELETE /api/listings/:id
 * @desc Delete a listing
 * @access Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch the listing first
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // End listings on marketplaces
    if (listing.ebay_listing_id) {
      await ebayService.endEbayListing(listing.ebay_listing_id);
    }
    
    if (listing.facebook_listing_id) {
      await facebookService.endFacebookListing(listing.facebook_listing_id);
    }
    
    // Delete the listing
    const { error: deleteError } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      return res.status(500).json({ 
        success: false, 
        message: `Failed to delete listing: ${deleteError.message}` 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    console.error(`Error in DELETE /listings/${req.params.id}:`, error);
    res.status(500).json({ success: false, message: `Failed to delete listing: ${error.message}` });
  }
});

/**
 * @route GET /api/listings/:id/check-sold
 * @desc Check if a listing has been sold
 * @access Public
 */
router.get('/:id/check-sold', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch the listing
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // If already marked as sold, return immediately
    if (listing.status === 'sold') {
      return res.status(200).json({
        success: true,
        sold: true,
        platform: null,
        message: 'Listing is already marked as sold'
      });
    }
    
    let ebayResult = { success: false, sold: false };
    let facebookResult = { success: false, sold: false };
    let soldPlatform = null;
    
    // Check eBay
    if (listing.ebay_listing_id) {
      ebayResult = await ebayService.checkEbayListingSold(listing.ebay_listing_id);
      if (ebayResult.success && ebayResult.sold) {
        soldPlatform = 'ebay';
      }
    }
    
    // Check Facebook
    if (listing.facebook_listing_id && !soldPlatform) {
      facebookResult = await facebookService.checkFacebookListingSold(listing.facebook_listing_id);
      if (facebookResult.success && facebookResult.sold) {
        soldPlatform = 'facebook';
      }
    }
    
    const sold = soldPlatform !== null;
    
    // If sold, update the listing and create a profit record
    if (sold) {
      // Update listing status
      const { error: updateError } = await supabase
        .from('listings')
        .update({
          status: 'sold',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (updateError) {
        console.error(`Error updating listing ${id} status to sold:`, updateError);
      }
      
      // Create profit record
      const { error: profitError } = await supabase
        .from('profits')
        .insert({
          listing_id: id,
          user_id: listing.user_id,
          amount: parseFloat(listing.price),
          platform: soldPlatform,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      
      if (profitError) {
        console.error(`Error creating profit record for listing ${id}:`, profitError);
      }
      
      // Send notification
      await notificationService.createNotification({
        user_id: listing.user_id,
        listing_id: id,
        type: 'item_sold',
        message: `Your listing "${listing.title}" has been sold on ${soldPlatform === 'ebay' ? 'eBay' : 'Facebook Marketplace'} for $${listing.price}. Payment will be processed within 24-48 hours.`
      });
    }
    
    res.status(200).json({
      success: true,
      sold,
      platform: soldPlatform,
      ebay: ebayResult,
      facebook: facebookResult
    });
  } catch (error) {
    console.error(`Error in GET /listings/${req.params.id}/check-sold:`, error);
    res.status(500).json({ success: false, message: `Failed to check if listing is sold: ${error.message}` });
  }
});

/**
 * @route POST /api/listings/:id/reduce-price
 * @desc Manually trigger a price reduction
 * @access Public
 */
router.post('/:id/reduce-price', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch the listing
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Reduce the price
    const result = await priceService.reduceListingPrice(listing);
    
    res.status(200).json(result);
  } catch (error) {
    console.error(`Error in POST /listings/${req.params.id}/reduce-price:`, error);
    res.status(500).json({ success: false, message: `Failed to reduce price: ${error.message}` });
  }
});

module.exports = router; 