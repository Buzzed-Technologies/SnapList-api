const axios = require('axios');
const ebayConfig = require('../config/ebay');
const { supabase } = require('../config/supabase');

/**
 * Create a new listing on eBay
 * @param {Object} listing - The listing data
 * @param {Array} imageUrls - Array of image URLs
 * @returns {Promise<Object>} - The created eBay listing
 */
async function createEbayListing(listing, imageUrls) {
  try {
    if (!ebayConfig.appId || !ebayConfig.authToken) {
      console.warn('eBay credentials not configured, skipping eBay listing');
      return { success: false, message: 'eBay API not configured' };
    }
    
    // In a real implementation, this would use the eBay Trading API or Inventory API
    // For demonstration purposes, we're using a simplified approach
    const ebayApiUrl = ebayConfig.sandbox
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';
    
    // Prepare the listing data
    const ebayListing = {
      Item: {
        Title: listing.title,
        Description: listing.description,
        PrimaryCategory: {
          CategoryID: '11450' // Default to Clothing, Shoes & Accessories
        },
        StartPrice: listing.price,
        ConditionID: 1000, // New
        Country: 'US',
        Currency: 'USD',
        DispatchTimeMax: 3, // 3 days handling time
        ListingDuration: 'Days_30',
        ListingType: 'FixedPriceItem',
        PaymentMethods: ['PayPal'],
        PayPalEmailAddress: 'seller@example.com',
        PictureDetails: {
          PictureURL: imageUrls.slice(0, 12) // eBay allows up to 12 images
        },
        ReturnPolicy: {
          ReturnsAcceptedOption: 'ReturnsAccepted',
          RefundOption: 'MoneyBack',
          ReturnsWithinOption: 'Days_30',
          ShippingCostPaidByOption: 'Buyer'
        },
        ShippingDetails: {
          ShippingType: 'Flat',
          ShippingServiceOptions: {
            ShippingServicePriority: 1,
            ShippingService: 'USPSPriority',
            ShippingServiceCost: 10.00
          }
        },
        Site: 'US'
      }
    };
    
    // Make the API request to eBay
    const response = await axios({
      method: 'post',
      url: ebayApiUrl,
      headers: {
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'AddItem',
        'X-EBAY-API-APP-NAME': ebayConfig.appId,
        'X-EBAY-API-DEV-NAME': ebayConfig.devId,
        'X-EBAY-API-CERT-NAME': ebayConfig.certId,
        'X-EBAY-API-IAF-TOKEN': ebayConfig.authToken,
        'Content-Type': 'application/xml'
      },
      data: generateEbayXml(ebayListing)
    });
    
    // Parse the response
    const ebayItemId = extractEbayItemId(response.data);
    
    if (!ebayItemId) {
      console.error('Failed to extract eBay item ID from response');
      return { success: false, message: 'Failed to create eBay listing' };
    }
    
    return {
      success: true,
      ebayItemId,
      ebayUrl: `https://${ebayConfig.sandbox ? 'sandbox.' : ''}ebay.com/itm/${ebayItemId}`
    };
  } catch (error) {
    console.error('Error creating eBay listing:', error.response?.data || error.message);
    return { success: false, message: `eBay listing creation failed: ${error.message}` };
  }
}

/**
 * Update an existing eBay listing
 * @param {string} ebayItemId - The eBay item ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object>} - The update result
 */
async function updateEbayListing(ebayItemId, updateData) {
  try {
    if (!ebayConfig.appId || !ebayConfig.authToken) {
      console.warn('eBay credentials not configured, skipping eBay listing update');
      return { success: false, message: 'eBay API not configured' };
    }
    
    // In a real implementation, this would use the eBay Trading API
    const ebayApiUrl = ebayConfig.sandbox
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';
    
    // Prepare the update data
    const ebayUpdate = {
      Item: {
        ItemID: ebayItemId,
        ...updateData
      }
    };
    
    // Make the API request to eBay
    const response = await axios({
      method: 'post',
      url: ebayApiUrl,
      headers: {
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'ReviseItem',
        'X-EBAY-API-APP-NAME': ebayConfig.appId,
        'X-EBAY-API-DEV-NAME': ebayConfig.devId,
        'X-EBAY-API-CERT-NAME': ebayConfig.certId,
        'X-EBAY-API-IAF-TOKEN': ebayConfig.authToken,
        'Content-Type': 'application/xml'
      },
      data: generateEbayXml(ebayUpdate)
    });
    
    // Check for success in the response
    const success = response.data.includes('<Ack>Success</Ack>');
    
    return { 
      success, 
      message: success ? 'eBay listing updated successfully' : 'Failed to update eBay listing'
    };
  } catch (error) {
    console.error('Error updating eBay listing:', error.response?.data || error.message);
    return { success: false, message: `eBay listing update failed: ${error.message}` };
  }
}

/**
 * End an eBay listing
 * @param {string} ebayItemId - The eBay item ID
 * @returns {Promise<Object>} - The end result
 */
async function endEbayListing(ebayItemId) {
  try {
    if (!ebayConfig.appId || !ebayConfig.authToken) {
      console.warn('eBay credentials not configured, skipping eBay listing end');
      return { success: false, message: 'eBay API not configured' };
    }
    
    // In a real implementation, this would use the eBay Trading API
    const ebayApiUrl = ebayConfig.sandbox
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';
    
    // Prepare the end listing request
    const ebayEnd = {
      ItemID: ebayItemId,
      EndingReason: 'NotAvailable'
    };
    
    // Make the API request to eBay
    const response = await axios({
      method: 'post',
      url: ebayApiUrl,
      headers: {
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'EndItem',
        'X-EBAY-API-APP-NAME': ebayConfig.appId,
        'X-EBAY-API-DEV-NAME': ebayConfig.devId,
        'X-EBAY-API-CERT-NAME': ebayConfig.certId,
        'X-EBAY-API-IAF-TOKEN': ebayConfig.authToken,
        'Content-Type': 'application/xml'
      },
      data: generateEbayXml(ebayEnd)
    });
    
    // Check for success in the response
    const success = response.data.includes('<Ack>Success</Ack>');
    
    return { 
      success, 
      message: success ? 'eBay listing ended successfully' : 'Failed to end eBay listing'
    };
  } catch (error) {
    console.error('Error ending eBay listing:', error.response?.data || error.message);
    return { success: false, message: `eBay listing end failed: ${error.message}` };
  }
}

/**
 * Check if an eBay listing has been sold
 * @param {string} ebayItemId - The eBay item ID
 * @returns {Promise<Object>} - The check result
 */
async function checkEbayListingSold(ebayItemId) {
  try {
    if (!ebayConfig.appId || !ebayConfig.authToken) {
      console.warn('eBay credentials not configured, skipping eBay listing check');
      return { success: false, message: 'eBay API not configured' };
    }
    
    // In a real implementation, this would use the eBay Trading API
    const ebayApiUrl = ebayConfig.sandbox
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';
    
    // Make the API request to eBay
    const response = await axios({
      method: 'post',
      url: ebayApiUrl,
      headers: {
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetItem',
        'X-EBAY-API-APP-NAME': ebayConfig.appId,
        'X-EBAY-API-DEV-NAME': ebayConfig.devId,
        'X-EBAY-API-CERT-NAME': ebayConfig.certId,
        'X-EBAY-API-IAF-TOKEN': ebayConfig.authToken,
        'Content-Type': 'application/xml'
      },
      data: generateEbayXml({ ItemID: ebayItemId })
    });
    
    // Check if the item is sold
    const soldStatus = extractEbaySoldStatus(response.data);
    
    return { 
      success: true,
      sold: soldStatus === 'Completed',
      status: soldStatus
    };
  } catch (error) {
    console.error('Error checking eBay listing:', error.response?.data || error.message);
    return { success: false, message: `eBay listing check failed: ${error.message}` };
  }
}

/**
 * Generate eBay XML request
 * @param {Object} data - The data to convert to XML
 * @returns {string} - The XML string
 */
function generateEbayXml(data) {
  // This is a simplified version; in a real implementation you would use a proper XML builder
  const generateXmlFromObject = (obj) => {
    let xml = '';
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      
      if (Array.isArray(value)) {
        xml += value.map(item => {
          if (typeof item === 'object') {
            return `<${key}>${generateXmlFromObject(item)}</${key}>`;
          }
          return `<${key}>${item}</${key}>`;
        }).join('');
      } else if (typeof value === 'object') {
        xml += `<${key}>${generateXmlFromObject(value)}</${key}>`;
      } else {
        xml += `<${key}>${value}</${key}>`;
      }
    }
    return xml;
  };
  
  return `<?xml version="1.0" encoding="utf-8"?><request>${generateXmlFromObject(data)}</request>`;
}

/**
 * Extract eBay item ID from response
 * @param {string} responseData - The response data
 * @returns {string|null} - The extracted item ID
 */
function extractEbayItemId(responseData) {
  // In a real implementation, you would use a proper XML parser
  const itemIdMatch = responseData.match(/<ItemID>(\d+)<\/ItemID>/);
  return itemIdMatch ? itemIdMatch[1] : null;
}

/**
 * Extract eBay sold status from response
 * @param {string} responseData - The response data
 * @returns {string} - The extracted status
 */
function extractEbaySoldStatus(responseData) {
  // In a real implementation, you would use a proper XML parser
  const statusMatch = responseData.match(/<ListingStatus>(.+?)<\/ListingStatus>/);
  return statusMatch ? statusMatch[1] : 'Unknown';
}

module.exports = {
  createEbayListing,
  updateEbayListing,
  endEbayListing,
  checkEbayListingSold
}; 