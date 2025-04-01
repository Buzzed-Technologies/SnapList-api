const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const openai = require('../config/openai');

// Define uploads directory based on environment
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const UPLOAD_DIR = isLambda 
  ? path.join('/tmp', process.env.UPLOAD_DIR || 'uploads') // Use /tmp in Lambda
  : path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads'); // Use local path otherwise

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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
    
    // Analyze image using OpenAI Vision
    const imageObjects = await detectObjectsInImage(imagePath);
    
    // If no objects detected or only one, return the original image
    if (!imageObjects || imageObjects.length <= 1) {
      return [{
        originalPath: imagePath,
        processedPath: imagePath,
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
        const croppedImagePath = path.join(UPLOAD_DIR, croppedImageName);
        
        await sharp(imagePath)
          .extract({ left: x, top: y, width, height })
          .toFile(croppedImagePath);
        
        return {
          originalPath: imagePath,
          processedPath: croppedImagePath,
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
      model: "gpt-4-vision-preview",
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
    
    // Call OpenAI API for listing generation
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Generate a detailed marketplace listing for this item. Include a concise title, detailed description, suggested price, category, brand (if identifiable), size (if applicable), and color. Format your response as a valid JSON object with title, description, price, category, brand, size, and color fields. The price should be a reasonable market value in USD."
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
 * @returns {Promise<string>} - Path to the optimized image
 */
async function optimizeImage(imagePath) {
  try {
    const optimizedImageName = `optimized_${path.basename(imagePath)}`;
    const optimizedImagePath = path.join(UPLOAD_DIR, optimizedImageName);
    
    await sharp(imagePath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(optimizedImagePath);
    
    return optimizedImagePath;
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