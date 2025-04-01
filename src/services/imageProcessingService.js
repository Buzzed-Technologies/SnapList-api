const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const openai = require('../config/openai');
const supabase = require('../config/supabase');
const os = require('os');

const BUCKET_NAME = 'snaplist-images';
const TMP_DIR = os.tmpdir();

// Create a temporary directory for image processing
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Upload file to Supabase Storage
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - File name
 * @returns {Promise<string>} - Public URL of uploaded file
 */
async function uploadToSupabase(buffer, fileName) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`uploads/${fileName}`, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`uploads/${fileName}`);
      
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Process an image to detect objects and potentially crop them
 * @param {string} imagePath - Path to the original image
 * @returns {Promise<Array>} - Array of processed image info
 */
async function processImage(imagePath) {
  try {
    // Get image metadata
    const metadata = await sharp(imagePath).metadata();
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Generate a unique filename
    const originalFileName = `${uuidv4()}${path.extname(imagePath)}`;
    
    // Upload to Supabase
    const originalUrl = await uploadToSupabase(imageBuffer, originalFileName);
    
    // Analyze image using OpenAI Vision
    const imageObjects = await detectObjectsInImage(imagePath);
    
    // If no objects detected or only one, return the original image
    if (!imageObjects || imageObjects.length <= 1) {
      return [{
        originalPath: imagePath,
        processedPath: originalUrl,
        publicUrl: originalUrl,
        coordinates: null,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format
        }
      }];
    }
    
    // Process each detected object
    const processedImages = await Promise.all(
      imageObjects.map(async (object) => {
        const { x, y, width, height, label } = object;
        
        // Create a cropped version of the image
        const croppedImageName = `${path.basename(imagePath, path.extname(imagePath))}_${label}_${uuidv4()}${path.extname(imagePath)}`;
        const tempCroppedPath = path.join(TMP_DIR, croppedImageName);
        
        await sharp(imagePath)
          .extract({ left: x, top: y, width, height })
          .toFile(tempCroppedPath);
        
        // Upload cropped image to Supabase
        const croppedBuffer = fs.readFileSync(tempCroppedPath);
        const croppedUrl = await uploadToSupabase(croppedBuffer, croppedImageName);
        
        // Remove temporary file
        fs.unlinkSync(tempCroppedPath);
        
        return {
          originalPath: imagePath,
          processedPath: tempCroppedPath,
          publicUrl: croppedUrl,
          coordinates: { x, y, width, height },
          metadata: {
            label,
            width,
            height,
            format: metadata.format
          }
        };
      })
    );
    
    return processedImages;
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * Detect objects in an image using OpenAI Vision
 * @param {string} imagePath - Path to the image
 * @returns {Promise<Array>} - Array of detected objects
 */
async function detectObjectsInImage(imagePath) {
  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Call OpenAI API for object detection
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Identify all distinct items in this image. For each item, provide a label and the bounding box coordinates (x, y, width, height) as percentages of the image dimensions. Format your response as a valid JSON array."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    // Parse the response to get object locations
    const content = response.choices[0].message.content;
    const parsedContent = JSON.parse(content);
    
    // Convert percentage-based coordinates to pixel coordinates
    const imageMetadata = await sharp(imagePath).metadata();
    const objects = parsedContent.objects.map(obj => ({
      label: obj.label,
      x: Math.floor((obj.bbox.x / 100) * imageMetadata.width),
      y: Math.floor((obj.bbox.y / 100) * imageMetadata.height),
      width: Math.floor((obj.bbox.width / 100) * imageMetadata.width),
      height: Math.floor((obj.bbox.height / 100) * imageMetadata.height)
    }));
    
    return objects;
  } catch (error) {
    console.error('Error detecting objects in image:', error);
    // Return empty array on error instead of failing completely
    return [];
  }
}

/**
 * Analyze image and generate listing details
 * @param {string} imagePath - Path to the image
 * @returns {Promise<Object>} - Generated listing details
 */
async function generateListingDetails(imagePath) {
  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Call OpenAI API for listing generation with an enhanced prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are an expert marketplace seller helping to create a compelling listing that will attract buyers on platforms like eBay and Facebook Marketplace. Analyze this image carefully and generate a professional marketplace listing.\n\nPlease include:\n1. A concise, SEO-friendly title that includes key product details (30-80 characters)\n2. A detailed, well-structured description highlighting features, condition, measurements, and selling points (100-200 words)\n3. A fair market price in USD (be specific with the exact dollar amount)\n4. The most appropriate category for the item\n5. Brand name (if identifiable)\n6. Size information (if applicable)\n7. Primary color and any secondary colors\n\nFormat your response as a valid JSON object with these fields: title, description, price (as a string with dollar sign), category, brand, size, and color."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });
    
    // Parse the response to get listing details
    const content = response.choices[0].message.content;
    const listingDetails = JSON.parse(content);
    
    return {
      title: listingDetails.title,
      description: listingDetails.description,
      price: parseFloat(listingDetails.price.replace(/[^0-9.]/g, '')), // Extract numeric price
      original_price: parseFloat(listingDetails.price.replace(/[^0-9.]/g, '')),
      category: listingDetails.category || null,
      brand: listingDetails.brand || null,
      size: listingDetails.size || null,
      color: listingDetails.color || null
    };
  } catch (error) {
    console.error('Error generating listing details:', error);
    throw new Error(`Failed to generate listing details: ${error.message}`);
  }
}

/**
 * Compress and optimize images for storage
 * @param {string} imagePath - Path to the original image
 * @returns {Promise<string>} - Public URL of the optimized image
 */
async function optimizeImage(imagePath) {
  try {
    const optimizedImageName = `optimized_${path.basename(imagePath)}`;
    const tempOptimizedPath = path.join(TMP_DIR, optimizedImageName);
    
    await sharp(imagePath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(tempOptimizedPath);
    
    // Upload optimized image to Supabase
    const optimizedBuffer = fs.readFileSync(tempOptimizedPath);
    const optimizedUrl = await uploadToSupabase(optimizedBuffer, optimizedImageName);
    
    // Remove temporary file
    fs.unlinkSync(tempOptimizedPath);
    
    return optimizedUrl;
  } catch (error) {
    console.error('Error optimizing image:', error);
    // Return original path on error
    return imagePath;
  }
}

module.exports = {
  processImage,
  detectObjectsInImage,
  generateListingDetails,
  optimizeImage
}; 