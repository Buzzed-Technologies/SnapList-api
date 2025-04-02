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
    // Enhanced validation to ensure all required credentials are present
    if (!ebayConfig.appId || !ebayConfig.certId || !ebayConfig.devId || !ebayConfig.authToken) {
      console.warn('eBay credentials not fully configured, skipping eBay listing');
      return { success: false, message: 'eBay API credentials not fully configured' };
    }
    
    // Log which credentials are missing for debugging purposes
    if (!ebayConfig.appId) console.warn('Missing EBAY_APP_ID in environment variables');
    if (!ebayConfig.certId) console.warn('Missing EBAY_CERT_ID in environment variables');
    if (!ebayConfig.devId) console.warn('Missing EBAY_DEV_ID in environment variables');
    if (!ebayConfig.authToken) console.warn('Missing EBAY_AUTH_TOKEN in environment variables');
    
    // In a real implementation, this would use the eBay Trading API or Inventory API
    // For demonstration purposes, we're using a simplified approach
    const ebayApiUrl = ebayConfig.sandbox
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';
    
    // Sanitize description to handle HTML content safely
    const sanitizeDescription = (desc) => {
      if (!desc) return '';
      
      // For simplicity, we'll wrap the description in CDATA if it contains HTML
      if (desc.includes('<') || desc.includes('&')) {
        return `<![CDATA[${desc}]]>`;
      }
      
      return desc;
    };
    
    // Process image URLs to ensure they're full URLs
    const processedImageUrls = (imageUrls || []).map(url => {
      // If the URL is already a full URL, use it as is
      if (url && url.startsWith('http')) {
        return url;
      }
      
      // Otherwise, assume it's just the filename and construct the full Supabase URL
      return `https://lsrdviupiuoztnccwdxk.supabase.co/storage/v1/object/public/snaplist-images/uploads/${url}`;
    });
    
    // Map condition to eBay condition ID
    const getConditionID = (condition) => {
      const conditionMap = {
        'New': 1000,
        'New with tags': 1000,
        'New without tags': 1500,
        'Used - Excellent': 2000,
        'Used - Good': 2500,
        'Used - Fair': 3000,
        'Used - Poor': 3500
      };
      
      return conditionMap[condition] || 1000; // Default to New if not found
    };
    
    // Map category to eBay category ID - could be expanded with more mappings
    const getCategoryID = (category) => {
      const categoryMap = {
        // Men's Clothing
        'T-Shirts': '185116',
        'Shirts': '185101',
        'Pants': '185105',
        'Jeans': '11483',
        'Shorts': '15689',
        'Suits': '3001',
        'Sweaters': '11484',
        'Coats & Jackets': '57988',
        'Activewear': '185099',
        
        // Women's Clothing
        'Dresses': '63861',
        'Tops & Blouses': '53159',
        'Skirts': '63864',
        "Women's Pants": '63863',
        "Women's Jeans": '11554',
        "Women's Shorts": '11555',
        "Women's Suits": '63866',
        "Women's Sweaters": '63866',
        "Women's Coats": '63862',
        "Women's Activewear": '185099',
        
        // Footwear
        'Shoes': '93427',
        "Men's Shoes": '93427',
        "Women's Shoes": '55793',
        'Athletic Shoes': '15709',
        'Boots': '11498',
        'Sandals': '62107',
        
        // Accessories
        'Accessories': '4250',
        'Watches': '14324',
        'Belts': '2993',
        'Hats': '52365',
        'Sunglasses': '79720',
        'Wallets': '2996',
        'Bags & Purses': '169291',
        'Jewelry': '281',
        
        // Electronics
        'Smartphones': '9355',
        'Laptops': '177',
        'Tablets': '171485',
        'Headphones': '112529',
        'Cameras': '625',
        'Smart Watches': '178893',
        'Video Games': '1249',
        'Gaming Consoles': '139971',
        
        // Home & Garden
        'Furniture': '3197',
        'Home Decor': '10033',
        'Kitchen': '20625',
        'Bedding': '20444',
        'Bath': '133696',
        'Tools': '631',
        
        // Baby & Kids
        'Baby Clothing': '3082',
        'Toys': '220',
        'Kids Clothing': '171146',
        
        // Sports & Outdoors
        'Sporting Goods': '888',
        'Fitness Equipment': '15273',
        'Cycling': '7294',
        'Camping': '16034',
        
        // Books & Media
        'Books': '267',
        'Movies': '11232',
        'Music': '11233'
      };
      
      return categoryMap[category] || '185116'; // Default to T-Shirts if not found
    };
    
    // Prepare the listing data
    const ebayListing = {
      Item: {
        Title: listing.title,
        Description: sanitizeDescription(listing.description),
        PrimaryCategory: {
          CategoryID: getCategoryID(listing.category)
        },
        StartPrice: listing.price,
        ConditionID: getConditionID(listing.condition),
        Country: 'US',
        Currency: 'USD',
        Location: 'United States', // Add required Location field
        DispatchTimeMax: 3, // 3 days handling time
        ListingDuration: 'GTC', // Good 'Til Cancelled - required for fixed price listings
        ListingType: 'FixedPriceItem',
        // Add required item specifics for the category
        ItemSpecifics: {
          NameValueList: [
            {
              Name: 'Brand',
              Value: listing.brand || 'Unbranded'
            },
            {
              Name: 'Model',
              Value: listing.model || 'Generic'
            },
            {
              Name: 'Type',
              Value: listing.type || 'Basic Tee'
            }
          ]
        },
        PictureDetails: {
          // eBay requires images to be hosted on a public server with https URLs
          // Use processed URLs that are guaranteed to be full URLs
          PictureURL: processedImageUrls
            .filter(url => url && url.startsWith('https://'))
            .slice(0, 12) // eBay allows up to 12 images
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
        Site: 'US',
        Country: 'US',
        Currency: 'USD'
      }
    };
    
    // Add more item specifics if available
    if (listing.color) {
      ebayListing.Item.ItemSpecifics.NameValueList.push({
        Name: 'Color',
        Value: listing.color
      });
    }
    
    if (listing.size) {
      ebayListing.Item.ItemSpecifics.NameValueList.push({
        Name: 'Size',
        Value: listing.size
      });
    }
    
    // Check if we have valid pictures before proceeding
    if (!ebayListing.Item.PictureDetails.PictureURL || ebayListing.Item.PictureDetails.PictureURL.length === 0) {
      console.warn('No valid image URLs for eBay listing, skipping PictureDetails');
      // Remove the PictureDetails entirely if no valid URLs
      delete ebayListing.Item.PictureDetails;
    }
    
    // Make the API request to eBay
    const response = await axios({
      method: 'post',
      url: ebayApiUrl,
      headers: {
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'AddItem',
        // Ensure we have actual values for the required headers
        'X-EBAY-API-APP-NAME': ebayConfig.appId || '',
        'X-EBAY-API-DEV-NAME': ebayConfig.devId || '',
        'X-EBAY-API-CERT-NAME': ebayConfig.certId || '',
        // IMPORTANT: The Trading API requires a User Auth Token, not an OAuth token
        // If the authToken starts with "Bearer", remove it as it's for REST APIs, not Trading API
        'X-EBAY-API-IAF-TOKEN': ebayConfig.authToken ? 
          (ebayConfig.authToken.startsWith('Bearer ') ? ebayConfig.authToken.substring(7) : ebayConfig.authToken) : '',
        'X-EBAY-API-DETAIL-LEVEL': '0',
        'Content-Type': 'application/xml'
      },
      data: generateEbayXml(ebayListing)
    });
    
    // Parse the response
    const ebayItemId = extractEbayItemId(response.data);
    
    // Check if the response indicates failure
    if (response.data.includes('<Ack>Failure</Ack>')) {
      // Extract error messages from the response
      const errorMatch = response.data.match(/<LongMessage>([^<]+)<\/LongMessage>/);
      const errorMessage = errorMatch ? errorMatch[1] : 'Unknown eBay API error';
      console.error('eBay API Error:', errorMessage);
      return { success: false, message: `eBay listing creation failed: ${errorMessage}` };
    }
    
    if (!ebayItemId) {
      console.error('Failed to extract eBay item ID from response');
      return { success: false, message: 'Failed to create eBay listing - no item ID returned' };
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
    if (!ebayConfig.appId || !ebayConfig.certId || !ebayConfig.devId || !ebayConfig.authToken) {
      console.warn('eBay credentials not fully configured, skipping eBay listing update');
      return { success: false, message: 'eBay API credentials not fully configured' };
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
        'X-EBAY-API-APP-NAME': ebayConfig.appId || '',
        'X-EBAY-API-DEV-NAME': ebayConfig.devId || '',
        'X-EBAY-API-CERT-NAME': ebayConfig.certId || '',
        'X-EBAY-API-IAF-TOKEN': ebayConfig.authToken ? 
          (ebayConfig.authToken.startsWith('Bearer ') ? ebayConfig.authToken.substring(7) : ebayConfig.authToken) : '',
        'X-EBAY-API-DETAIL-LEVEL': '0',
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
    if (!ebayConfig.appId || !ebayConfig.certId || !ebayConfig.devId || !ebayConfig.authToken) {
      console.warn('eBay credentials not fully configured, skipping eBay listing end');
      return { success: false, message: 'eBay API credentials not fully configured' };
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
        'X-EBAY-API-APP-NAME': ebayConfig.appId || '',
        'X-EBAY-API-DEV-NAME': ebayConfig.devId || '',
        'X-EBAY-API-CERT-NAME': ebayConfig.certId || '',
        'X-EBAY-API-IAF-TOKEN': ebayConfig.authToken ? 
          (ebayConfig.authToken.startsWith('Bearer ') ? ebayConfig.authToken.substring(7) : ebayConfig.authToken) : '',
        'X-EBAY-API-DETAIL-LEVEL': '0',
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
    if (!ebayConfig.appId || !ebayConfig.certId || !ebayConfig.devId || !ebayConfig.authToken) {
      console.warn('eBay credentials not fully configured, skipping eBay listing check');
      return { success: false, message: 'eBay API credentials not fully configured' };
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
        'X-EBAY-API-APP-NAME': ebayConfig.appId || '',
        'X-EBAY-API-DEV-NAME': ebayConfig.devId || '',
        'X-EBAY-API-CERT-NAME': ebayConfig.certId || '',
        'X-EBAY-API-IAF-TOKEN': ebayConfig.authToken ? 
          (ebayConfig.authToken.startsWith('Bearer ') ? ebayConfig.authToken.substring(7) : ebayConfig.authToken) : '',
        'X-EBAY-API-DETAIL-LEVEL': '0',
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
  // Function to escape XML special characters
  const escapeXml = (unsafe) => {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

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
          return `<${key}>${escapeXml(item)}</${key}>`;
        }).join('');
      } else if (typeof value === 'object') {
        xml += `<${key}>${generateXmlFromObject(value)}</${key}>`;
      } else {
        xml += `<${key}>${escapeXml(value)}</${key}>`;
      }
    }
    return xml;
  };
  
  // Determine which API call we're making based on the data
  let requestType = 'AddItemRequest';
  if (data.ItemID && !data.Item) {
    requestType = 'GetItemRequest';
  } else if (data.ItemID && data.EndingReason) {
    requestType = 'EndItemRequest';
  } else if (data.Item && data.Item.ItemID) {
    requestType = 'ReviseItemRequest';
  }
  
  return `<?xml version="1.0" encoding="utf-8"?><${requestType} xmlns="urn:ebay:apis:eBLBaseComponents">${generateXmlFromObject(data)}</${requestType}>`;
}

/**
 * Extract eBay item ID from response
 * @param {string} responseData - The response data
 * @returns {string|null} - The extracted item ID
 */
function extractEbayItemId(responseData) {
  // In a real implementation, you would use a proper XML parser
  console.log('eBay response:', responseData); // Add debugging to see the actual response
  
  // Try more flexible pattern matching that handles potential namespaces
  const itemIdMatch = responseData.match(/<([\w:]*)?ItemID>([^<]+)<\/([\w:]*)?ItemID>/);
  if (itemIdMatch && itemIdMatch[2]) {
    return itemIdMatch[2];
  }
  
  // If still not found, try another common format
  const altMatch = responseData.match(/ItemID[^>]*>([^<]+)</);
  return altMatch ? altMatch[1] : null;
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