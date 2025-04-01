// Facebook API configuration
const facebookConfig = {
  appId: process.env.FACEBOOK_APP_ID,
  appSecret: process.env.FACEBOOK_APP_SECRET,
  accessToken: process.env.FACEBOOK_ACCESS_TOKEN
};

// Validate Facebook configuration
if (!facebookConfig.appId || !facebookConfig.appSecret || !facebookConfig.accessToken) {
  console.warn('Missing Facebook API credentials in environment variables');
}

module.exports = facebookConfig; 