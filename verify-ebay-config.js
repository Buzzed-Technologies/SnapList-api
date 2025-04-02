/**
 * eBay Configuration Verification Script
 * 
 * This script verifies your eBay API configuration and helps diagnose issues.
 * Run it with: node verify-ebay-config.js
 */

// Load environment variables if using dotenv (for local testing)
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not found, assuming environment variables are already set');
}

console.log('======= eBay Configuration Verification =======');
console.log('Checking environment variables...');

// Check all required eBay environment variables
const requiredVars = [
  'EBAY_APP_ID',
  'EBAY_CERT_ID',
  'EBAY_DEV_ID',
  'EBAY_AUTH_TOKEN',
  'EBAY_SANDBOX_MODE'
];

let allGood = true;
const config = {};

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = !!value;
  config[varName] = value;
  
  console.log(`${varName}: ${isSet ? 'Set ✓' : 'NOT SET ✗'}`);
  if (isSet) {
    // Show a preview of the value (first 4 chars) for verification
    const preview = value.substring(0, 4) + '...';
    console.log(`  Value preview: ${preview}`);
  } else {
    allGood = false;
  }
});

// Specific checks for common issues
if (config.EBAY_CERT_ID && config.EBAY_CERT_ID.startsWith('SBX-')) {
  console.log('NOTE: Your Cert ID starts with "SBX-", indicating this is a Sandbox credential');
  
  if (config.EBAY_SANDBOX_MODE !== 'true') {
    console.log('WARNING: You are using sandbox credentials but EBAY_SANDBOX_MODE is not "true"');
    console.log('This will cause authentication errors. Set EBAY_SANDBOX_MODE=true');
    allGood = false;
  }
}

// Verify that APP_ID doesn't contain the "text" placeholder
if (config.EBAY_APP_ID === 'text' || config.EBAY_APP_ID?.includes('text')) {
  console.log('ERROR: Your EBAY_APP_ID contains "text", which appears to be a placeholder.');
  console.log('Update your environment variable with your actual eBay App ID');
  allGood = false;
}

// Verify auth token format
if (config.EBAY_AUTH_TOKEN) {
  if (config.EBAY_AUTH_TOKEN.startsWith('Bearer ')) {
    console.log('WARNING: Your EBAY_AUTH_TOKEN starts with "Bearer ", which is incorrect for the Trading API');
    console.log('Remove the "Bearer " prefix from your token');
    allGood = false;
  }
}

console.log('\nSummary:');
if (allGood) {
  console.log('✅ Your eBay configuration appears to be correctly set up.');
} else {
  console.log('❌ There are issues with your eBay configuration that need to be addressed.');
}

console.log('\nVercel Environment Variables Guide:');
console.log('1. Go to your Vercel project dashboard');
console.log('2. Click on "Settings" > "Environment Variables"');
console.log('3. Add or update your environment variables');
console.log('4. Redeploy your application after making changes');
console.log('\nRemember that Vercel environment variables are only available during deployment and runtime,');
console.log('not during the build process. If you need them during build, mark them as "Development".');

// Output the complete config for diagnostic purposes
console.log('\nFull configuration (SECURE, only run this locally):');
console.log(JSON.stringify(config, null, 2)); 