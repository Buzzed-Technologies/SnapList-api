// eBay API configuration
const ebayConfig = {
  appId: process.env.EBAY_APP_ID,
  certId: process.env.EBAY_CERT_ID,
  devId: process.env.EBAY_DEV_ID,
  authToken: process.env.EBAY_AUTH_TOKEN,
  sandbox: process.env.EBAY_SANDBOX_MODE === 'true'
};

// Print the first few characters of each credential for debugging (not the full values for security)
console.log('eBay API Configuration:');
console.log('- App ID:', ebayConfig.appId ? `${ebayConfig.appId.substring(0, 4)}...` : 'Not set');
console.log('- Cert ID:', ebayConfig.certId ? `${ebayConfig.certId.substring(0, 4)}...` : 'Not set');
console.log('- Dev ID:', ebayConfig.devId ? `${ebayConfig.devId.substring(0, 4)}...` : 'Not set');
console.log('- Auth Token:', ebayConfig.authToken ? `${ebayConfig.authToken.substring(0, 4)}...` : 'Not set');
console.log('- Sandbox Mode:', ebayConfig.sandbox);

// Validate eBay configuration
if (!ebayConfig.appId || !ebayConfig.certId || !ebayConfig.devId || !ebayConfig.authToken) {
  console.warn('Missing eBay API credentials in environment variables');
}

module.exports = ebayConfig; 