/**
 * SnapList API Test Script
 * This script can be used to test the API endpoints
 * Run with: node src/utils/test-endpoints.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Config
const API_URL = 'http://localhost:3000/api';
let userId = null;
let listingId = null;
let profitId = null;
let imageUrl = null;

// Helper function to make requests
async function makeRequest(method, endpoint, data = null) {
  try {
    const url = `${API_URL}${endpoint}`;
    console.log(`\n${method} ${url}`);
    
    const response = await axios({
      method,
      url,
      data
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

// Test user endpoints
async function testUserEndpoints() {
  console.log('\n--- Testing User Endpoints ---');
  
  // Create a user
  const userData = {
    name: 'Test User',
    birthday: '1990-01-01', // Over 13 years old
    phone: '555-123-4567',
    zelle_id: 'test.user@example.com'
  };
  
  const createResult = await makeRequest('post', '/users', userData);
  if (createResult?.success) {
    userId = createResult.user.id;
    console.log(`Created user ID: ${userId}`);
  }
  
  if (userId) {
    // Get user
    await makeRequest('get', `/users/${userId}`);
    
    // Update user
    const updateData = {
      name: 'Updated Test User',
      phone: '555-987-6543'
    };
    await makeRequest('put', `/users/${userId}`, updateData);
    
    // Get user stats
    await makeRequest('get', `/users/${userId}/stats`);
  }
}

// Test image endpoints
async function testImageEndpoints() {
  console.log('\n--- Testing Image Endpoints ---');
  
  // Create a test image if it doesn't exist
  const testImgDir = path.join(__dirname, '../../test-assets');
  const testImgPath = path.join(testImgDir, 'test-image.jpg');
  
  if (!fs.existsSync(testImgDir)) {
    fs.mkdirSync(testImgDir, { recursive: true });
  }
  
  if (!fs.existsSync(testImgPath)) {
    console.log('Creating a test image...');
    
    // Create a simple test image (black square)
    const sharp = require('sharp');
    await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .jpeg()
    .toFile(testImgPath);
  }
  
  // Upload image using FormData
  console.log('Image upload test requires manual testing with a tool like Postman');
  console.log('POST /api/images/upload with form-data: { image: <file> }');
  
  // For testing other endpoints, we'll use a placeholder image URL
  imageUrl = 'uploads/test-image.jpg';
  
  // Process image
  await makeRequest('post', '/images/process', { imagePath: imageUrl });
  
  // Analyze image
  await makeRequest('post', '/images/analyze', { imagePath: imageUrl });
}

// Test listing endpoints
async function testListingEndpoints() {
  console.log('\n--- Testing Listing Endpoints ---');
  
  if (!userId || !imageUrl) {
    console.log('Skipping listing tests (missing userId or imageUrl)');
    return;
  }
  
  // Create a listing
  const listingData = {
    user_id: userId,
    title: 'Test Listing',
    description: 'This is a test listing created by the test script',
    price: 29.99,
    image_urls: [imageUrl]
  };
  
  const createResult = await makeRequest('post', '/listings', listingData);
  if (createResult?.success) {
    listingId = createResult.listing.id;
    console.log(`Created listing ID: ${listingId}`);
  }
  
  if (listingId) {
    // Get listings
    await makeRequest('get', `/listings?user_id=${userId}`);
    
    // Get specific listing
    await makeRequest('get', `/listings/${listingId}`);
    
    // Update listing
    const updateData = {
      title: 'Updated Test Listing',
      price: 24.99
    };
    await makeRequest('put', `/listings/${listingId}`, updateData);
    
    // Check if sold
    await makeRequest('get', `/listings/${listingId}/check-sold`);
    
    // Reduce price
    await makeRequest('post', `/listings/${listingId}/reduce-price`);
  }
}

// Test profit endpoints
async function testProfitEndpoints() {
  console.log('\n--- Testing Profit Endpoints ---');
  
  if (!userId) {
    console.log('Skipping profit tests (missing userId)');
    return;
  }
  
  // Get profits
  await makeRequest('get', `/profits?user_id=${userId}`);
  
  // Get profit summary
  await makeRequest('get', `/profits/summary?user_id=${userId}`);
  
  // Note: We're not testing specific profit endpoints as they would require a sold listing
  console.log('Note: Additional profit tests require a sold listing');
}

// Main test function
async function runTests() {
  console.log('Starting SnapList API tests');
  
  await testUserEndpoints();
  await testImageEndpoints();
  await testListingEndpoints();
  await testProfitEndpoints();
  
  console.log('\n--- Tests Completed ---');
  
  // Clean up (optional)
  if (listingId) {
    console.log('\nCleaning up test data...');
    await makeRequest('delete', `/listings/${listingId}`);
  }
}

runTests().catch(console.error); 