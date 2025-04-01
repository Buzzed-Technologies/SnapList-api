const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const imageProcessingService = require('../services/imageProcessingService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

/**
 * @route POST /api/images/upload
 * @desc Upload an image
 * @access Public
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }
    
    // Optimize the uploaded image
    const originalPath = req.file.path;
    const optimizedPath = await imageProcessingService.optimizeImage(originalPath);
    
    // Construct URLs for the images
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/${path.basename(optimizedPath)}`;
    
    res.status(200).json({
      success: true,
      image: {
        url: imageUrl,
        filename: path.basename(optimizedPath),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, message: `Image upload failed: ${error.message}` });
  }
});

/**
 * @route POST /api/images/process
 * @desc Process an image to detect objects
 * @access Public
 */
router.post('/process', async (req, res) => {
  try {
    const { imagePath } = req.body;
    
    if (!imagePath) {
      return res.status(400).json({ success: false, message: 'Image path is required' });
    }
    
    // Convert relative URL to file path
    const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
    const filename = path.basename(imagePath);
    const filePath = path.join(uploadDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Image file not found' });
    }
    
    // Process the image
    const processedImages = await imageProcessingService.processImage(filePath);
    
    // Generate URLs for the processed images
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const processedImageUrls = processedImages.map(img => ({
      url: `${baseUrl}/uploads/${path.basename(img.processedPath)}`,
      coordinates: img.coordinates,
      metadata: img.metadata
    }));
    
    res.status(200).json({
      success: true,
      images: processedImageUrls,
      count: processedImageUrls.length
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ success: false, message: `Image processing failed: ${error.message}` });
  }
});

/**
 * @route POST /api/images/analyze
 * @desc Analyze an image and generate listing details
 * @access Public
 */
router.post('/analyze', async (req, res) => {
  try {
    const { imagePath } = req.body;
    
    if (!imagePath) {
      return res.status(400).json({ success: false, message: 'Image path is required' });
    }
    
    // Convert relative URL to file path
    const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
    const filename = path.basename(imagePath);
    const filePath = path.join(uploadDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Image file not found' });
    }
    
    // Generate listing details from the image
    const listingDetails = await imageProcessingService.generateListingDetails(filePath);
    
    res.status(200).json({
      success: true,
      listingDetails
    });
  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ success: false, message: `Image analysis failed: ${error.message}` });
  }
});

/**
 * @route DELETE /api/images/:filename
 * @desc Delete an uploaded image
 * @access Public
 */
router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Filename is required' });
    }
    
    // Prevent directory traversal attacks
    const sanitizedFilename = path.basename(filename);
    
    // Get file path
    const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
    const filePath = path.join(uploadDir, sanitizedFilename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Image file not found' });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: `Image deletion failed: ${error.message}` });
  }
});

module.exports = router; 