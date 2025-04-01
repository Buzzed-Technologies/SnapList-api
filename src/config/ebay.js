// eBay API configuration
const ebayConfig = {
  appId: process.env.EBAY_APP_ID,
  certId: process.env.EBAY_CERT_ID,
  devId: process.env.EBAY_DEV_ID,
  authToken: process.env.EBAY_AUTH_TOKEN,
  sandbox: process.env.EBAY_SANDBOX_MODE === 'true'
};

// Validate eBay configuration
if (!ebayConfig.appId || !ebayConfig.certId || !ebayConfig.devId || !ebayConfig.authToken) {
  console.warn('Missing eBay API credentials in environment variables');
}

module.exports = ebayConfig; 