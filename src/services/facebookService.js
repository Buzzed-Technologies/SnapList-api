const axios = require('axios');
const facebookConfig = require('../config/facebook');
const supabase = require('../config/supabase');

/**
 * Create a new listing on Facebook Marketplace
 * @param {Object} listing - The listing data
 * @param {Array} imageUrls - Array of image URLs
 * @returns {Promise<Object>} - The created Facebook listing
 */
async function createFacebookListing(listing, imageUrls) {
  try {
    if (!facebookConfig.accessToken) {
      console.warn('Facebook credentials not configured, skipping Facebook listing');
      return { success: false, message: 'Facebook API not configured' };
    }
    
    // Facebook Commerce API endpoint
    const fbApiUrl = 'https://graph.facebook.com/v18.0/me/commerce_listings';
    
    // Prepare the listing data
    const fbListing = {
      name: listing.title,
      description: listing.description,
      price: listing.price,
      currency: 'USD',
      availability: 'in stock',
      condition: 'new',
      shipping_options: [
        {
          name: 'Standard Shipping',
          price: 10.00
        }
      ],
      images: imageUrls.slice(0, 10).map(url => ({ url })),
      brand: 'SnapList',
      category: 'CLOTHING_ACCESSORIES' // Default category
    };
    
    // Make the API request to Facebook
    const response = await axios({
      method: 'post',
      url: fbApiUrl,
      params: {
        access_token: facebookConfig.accessToken
      },
      data: fbListing
    });
    
    if (!response.data || !response.data.id) {
      console.error('Failed to extract Facebook listing ID from response');
      return { success: false, message: 'Failed to create Facebook listing' };
    }
    
    const fbListingId = response.data.id;
    
    return {
      success: true,
      fbListingId,
      fbUrl: `https://www.facebook.com/marketplace/item/${fbListingId}`
    };
  } catch (error) {
    console.error('Error creating Facebook listing:', error.response?.data || error.message);
    return { success: false, message: `Facebook listing creation failed: ${error.message}` };
  }
}

/**
 * Update an existing Facebook Marketplace listing
 * @param {string} fbListingId - The Facebook listing ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object>} - The update result
 */
async function updateFacebookListing(fbListingId, updateData) {
  try {
    if (!facebookConfig.accessToken) {
      console.warn('Facebook credentials not configured, skipping Facebook listing update');
      return { success: false, message: 'Facebook API not configured' };
    }
    
    // Facebook Commerce API endpoint
    const fbApiUrl = `https://graph.facebook.com/v18.0/${fbListingId}`;
    
    // Make the API request to Facebook
    const response = await axios({
      method: 'post',
      url: fbApiUrl,
      params: {
        access_token: facebookConfig.accessToken
      },
      data: updateData
    });
    
    const success = response.data && response.data.success === true;
    
    return { 
      success, 
      message: success ? 'Facebook listing updated successfully' : 'Failed to update Facebook listing'
    };
  } catch (error) {
    console.error('Error updating Facebook listing:', error.response?.data || error.message);
    return { success: false, message: `Facebook listing update failed: ${error.message}` };
  }
}

/**
 * End a Facebook Marketplace listing
 * @param {string} fbListingId - The Facebook listing ID
 * @returns {Promise<Object>} - The end result
 */
async function endFacebookListing(fbListingId) {
  try {
    if (!facebookConfig.accessToken) {
      console.warn('Facebook credentials not configured, skipping Facebook listing end');
      return { success: false, message: 'Facebook API not configured' };
    }
    
    // Facebook Commerce API endpoint
    const fbApiUrl = `https://graph.facebook.com/v18.0/${fbListingId}`;
    
    // Make the API request to Facebook to delete the listing
    const response = await axios({
      method: 'delete',
      url: fbApiUrl,
      params: {
        access_token: facebookConfig.accessToken
      }
    });
    
    const success = response.data && response.data.success === true;
    
    return { 
      success, 
      message: success ? 'Facebook listing ended successfully' : 'Failed to end Facebook listing'
    };
  } catch (error) {
    console.error('Error ending Facebook listing:', error.response?.data || error.message);
    return { success: false, message: `Facebook listing end failed: ${error.message}` };
  }
}

/**
 * Check if a Facebook Marketplace listing has been sold
 * @param {string} fbListingId - The Facebook listing ID
 * @returns {Promise<Object>} - The check result
 */
async function checkFacebookListingSold(fbListingId) {
  try {
    if (!facebookConfig.accessToken) {
      console.warn('Facebook credentials not configured, skipping Facebook listing check');
      return { success: false, message: 'Facebook API not configured' };
    }
    
    // Facebook Commerce API endpoint
    const fbApiUrl = `https://graph.facebook.com/v18.0/${fbListingId}`;
    
    // Make the API request to Facebook
    const response = await axios({
      method: 'get',
      url: fbApiUrl,
      params: {
        access_token: facebookConfig.accessToken,
        fields: 'state'
      }
    });
    
    if (!response.data || !response.data.state) {
      return { success: false, message: 'Failed to fetch Facebook listing status' };
    }
    
    const state = response.data.state;
    const sold = state === 'SOLD';
    
    return { 
      success: true,
      sold,
      status: state
    };
  } catch (error) {
    console.error('Error checking Facebook listing:', error.response?.data || error.message);
    return { success: false, message: `Facebook listing check failed: ${error.message}` };
  }
}

module.exports = {
  createFacebookListing,
  updateFacebookListing,
  endFacebookListing,
  checkFacebookListingSold
}; 