// eBay API configuration
/*
 * Instructions for setting up eBay API credentials:
 * 
 * For the Traditional/Trading API used in this application:
 * 1. Create a developer account at https://developer.ebay.com
 * 2. Create an application in the Developer Portal
 * 3. Get your AppID (Client ID), CertID (Client Secret), and DevID from the application keys
 * 4. Generate a User Auth Token:
 *    - This is NOT the same as the OAuth token used for REST APIs
 *    - Go to the "User Tokens" section in the developer portal
 *    - Generate a token for the Trading API
 *    - This token is specific to a user's eBay account and allows operations on their behalf
 *    - The token looks like a long alphanumeric string without "Bearer" prefix
 * 
 * IMPORTANT: If you're getting "IAF token supplied is invalid" errors, ensure:
 * 1. You're using a User Auth Token for Trading API, not an OAuth token
 * 2. The token hasn't expired (they typically last 1-2 years)
 * 3. The token is for the correct environment (production vs. sandbox)
 */

// Check if we should force sandbox mode based on credentials
const detectSandboxFromCredentials = (certId) => {
  // If certId starts with "SBX-", it's a sandbox credential
  return certId && certId.startsWith('SBX-');
};

const ebayConfig = {
  appId: process.env.EBAY_APP_ID,
  certId: process.env.EBAY_CERT_ID,
  devId: process.env.EBAY_DEV_ID,
  authToken: process.env.EBAY_AUTH_TOKEN,
  // If EBAY_SANDBOX_MODE is not explicitly set, detect it from credentials
  sandbox: process.env.EBAY_SANDBOX_MODE === 'true' || 
           (process.env.EBAY_SANDBOX_MODE !== 'false' && detectSandboxFromCredentials(process.env.EBAY_CERT_ID))
};

// Print the first few characters of each credential for debugging (not the full values for security)
console.log('eBay API Configuration:');
console.log('- App ID:', ebayConfig.appId ? `${ebayConfig.appId.substring(0, 4)}...` : 'Not set');
console.log('- Cert ID:', ebayConfig.certId ? `${ebayConfig.certId.substring(0, 4)}...` : 'Not set');
console.log('- Dev ID:', ebayConfig.devId ? `${ebayConfig.devId.substring(0, 4)}...` : 'Not set');
console.log('- Auth Token:', ebayConfig.authToken ? `${ebayConfig.authToken.substring(0, 4)}...` : 'Not set');
console.log('- Sandbox Mode:', ebayConfig.sandbox);

// Validate credential and environment consistency
if (ebayConfig.certId && ebayConfig.certId.startsWith('SBX-') && !ebayConfig.sandbox) {
  console.warn('WARNING: Using Sandbox credentials (SBX-) but Sandbox mode is disabled. Setting Sandbox mode to true.');
  ebayConfig.sandbox = true;
}

// Validate eBay configuration
if (!ebayConfig.appId || !ebayConfig.certId || !ebayConfig.devId || !ebayConfig.authToken) {
  console.warn('Missing eBay API credentials in environment variables');
}

module.exports = ebayConfig; 