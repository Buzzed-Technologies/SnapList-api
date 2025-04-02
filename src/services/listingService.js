const { supabase } = require('../config/supabase');

/**
 * Get a listing by ID with price history
 * @param {string} id - Listing ID
 * @returns {Promise<Object>} - Listing and price history
 */
async function getListingById(id) {
  try {
    // First get the listing
    const { data: listing, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!listing) return null;
    
    // Format dates for consistent handling
    listing.created_at = new Date(listing.created_at).toISOString();
    listing.updated_at = new Date(listing.updated_at).toISOString();
    
    // Get price history
    const { data: priceHistory, error: priceHistoryError } = await supabase
      .from('price_history')
      .select('*')
      .eq('listing_id', id)
      .order('created_at', { ascending: true });
    
    if (priceHistoryError) throw priceHistoryError;
    
    return { 
      success: true,
      listing,
      priceHistory: priceHistory || []
    };
  } catch (error) {
    console.error('Error in getListingById:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getListingById
}; 