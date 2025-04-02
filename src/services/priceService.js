const { supabase } = require('../config/supabase');
const ebayService = require('./ebayService');
const facebookService = require('./facebookService');
const notificationService = require('./notificationService');

/**
 * Schedule price reductions for active listings
 * @returns {Promise<void>}
 */
async function schedulePriceReductions() {
  try {
    console.log('Running scheduled price reduction job');
    
    // Get all active listings that haven't been updated in at least 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: listings, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .lt('last_price_update', sevenDaysAgo.toISOString());
    
    if (error) {
      console.error('Error fetching listings for price reduction:', error);
      return;
    }
    
    console.log(`Found ${listings.length} listings eligible for price reduction`);
    
    // Process each listing
    for (const listing of listings) {
      await reduceListingPrice(listing);
    }
    
    console.log('Price reduction job completed');
  } catch (error) {
    console.error('Error in price reduction job:', error);
  }
}

/**
 * Reduce the price of a listing by 10%
 * @param {Object} listing - The listing to reduce
 * @returns {Promise<Object>} - The result of the reduction
 */
async function reduceListingPrice(listing) {
  try {
    // Calculate new price (10% reduction)
    const currentPrice = parseFloat(listing.price);
    const minPrice = parseFloat(listing.min_price);
    let newPrice = Math.round((currentPrice * 0.9) * 100) / 100; // Round to 2 decimal places
    
    // Don't go below minimum price (50% of original)
    if (newPrice < minPrice) {
      newPrice = minPrice;
    }
    
    // If already at minimum price, no need to reduce further
    if (currentPrice <= minPrice) {
      console.log(`Listing ${listing.id} already at minimum price, skipping reduction`);
      return { success: true, message: 'Listing already at minimum price' };
    }
    
    console.log(`Reducing price for listing ${listing.id} from ${currentPrice} to ${newPrice}`);
    
    // Update the price on eBay if available
    if (listing.ebay_listing_id) {
      const ebayUpdateResult = await ebayService.updateEbayListing(listing.ebay_listing_id, {
        StartPrice: newPrice
      });
      
      if (!ebayUpdateResult.success) {
        console.error(`Error updating eBay price for listing ${listing.id}:`, ebayUpdateResult.message);
      }
    }
    
    // Update the price on Facebook if available
    if (listing.facebook_listing_id) {
      const fbUpdateResult = await facebookService.updateFacebookListing(listing.facebook_listing_id, {
        price: newPrice
      });
      
      if (!fbUpdateResult.success) {
        console.error(`Error updating Facebook price for listing ${listing.id}:`, fbUpdateResult.message);
      }
    }
    
    // Record price history
    const { error: historyError } = await supabase
      .from('price_history')
      .insert({
        listing_id: listing.id,
        previous_price: currentPrice,
        new_price: newPrice,
        reason: 'automatic'
      });
    
    if (historyError) {
      console.error(`Error recording price history for listing ${listing.id}:`, historyError);
    }
    
    // Update listing in database
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        price: newPrice,
        last_price_update: new Date().toISOString()
      })
      .eq('id', listing.id);
    
    if (updateError) {
      console.error(`Error updating listing ${listing.id} price in database:`, updateError);
      return { success: false, message: `Database update failed: ${updateError.message}` };
    }
    
    // Send notification to user
    await notificationService.createNotification({
      user_id: listing.user_id,
      listing_id: listing.id,
      type: 'price_reduction',
      message: `The price for your listing "${listing.title}" has been automatically reduced from $${currentPrice} to $${newPrice}.`
    });
    
    return { 
      success: true, 
      message: 'Price reduced successfully',
      oldPrice: currentPrice,
      newPrice
    };
  } catch (error) {
    console.error(`Error reducing price for listing ${listing.id}:`, error);
    return { success: false, message: `Price reduction failed: ${error.message}` };
  }
}

/**
 * Manually update a listing price
 * @param {string} listingId - The listing ID
 * @param {number} newPrice - The new price
 * @returns {Promise<Object>} - The result of the update
 */
async function updateListingPrice(listingId, newPrice) {
  try {
    // Get the listing
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();
    
    if (fetchError) {
      console.error(`Error fetching listing ${listingId}:`, fetchError);
      return { success: false, message: `Failed to fetch listing: ${fetchError.message}` };
    }
    
    if (!listing) {
      return { success: false, message: 'Listing not found' };
    }
    
    const currentPrice = parseFloat(listing.price);
    
    // Update the price on eBay if available
    if (listing.ebay_listing_id) {
      const ebayUpdateResult = await ebayService.updateEbayListing(listing.ebay_listing_id, {
        StartPrice: newPrice
      });
      
      if (!ebayUpdateResult.success) {
        console.error(`Error updating eBay price for listing ${listingId}:`, ebayUpdateResult.message);
      }
    }
    
    // Update the price on Facebook if available
    if (listing.facebook_listing_id) {
      const fbUpdateResult = await facebookService.updateFacebookListing(listing.facebook_listing_id, {
        price: newPrice
      });
      
      if (!fbUpdateResult.success) {
        console.error(`Error updating Facebook price for listing ${listingId}:`, fbUpdateResult.message);
      }
    }
    
    // Record price history
    const { error: historyError } = await supabase
      .from('price_history')
      .insert({
        listing_id: listingId,
        previous_price: currentPrice,
        new_price: newPrice,
        reason: 'manual'
      });
    
    if (historyError) {
      console.error(`Error recording price history for listing ${listingId}:`, historyError);
    }
    
    // Update listing in database
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        price: newPrice,
        last_price_update: new Date().toISOString()
      })
      .eq('id', listingId);
    
    if (updateError) {
      console.error(`Error updating listing ${listingId} price in database:`, updateError);
      return { success: false, message: `Database update failed: ${updateError.message}` };
    }
    
    return { 
      success: true, 
      message: 'Price updated successfully',
      oldPrice: currentPrice,
      newPrice
    };
  } catch (error) {
    console.error(`Error updating price for listing ${listingId}:`, error);
    return { success: false, message: `Price update failed: ${error.message}` };
  }
}

module.exports = {
  schedulePriceReductions,
  reduceListingPrice,
  updateListingPrice
}; 