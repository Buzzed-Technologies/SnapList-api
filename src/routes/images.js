const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const imageProcessingService = require('../services/imageProcessingService');
const { supabase } = require('../config/supabase');
const os = require('os');

const router = express.Router();

// Configure multer for temporary file uploads
const tempDir = path.join(os.tmpdir(), 'snaplist-uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
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

const BUCKET_NAME = 'snaplist-images';

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
    const optimizedUrl = await imageProcessingService.optimizeImage(originalPath);
    
    // Check if auto_analyze flag is set
    const shouldAutoAnalyze = req.body.auto_analyze === 'true';
    
    // Delete temporary file
    fs.unlinkSync(originalPath);
    
    // Prepare response data
    const imageData = {
      url: optimizedUrl,
      filename: path.basename(optimizedUrl),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    };
    
    // Auto analyze if requested
    let listingDetails = null;
    if (shouldAutoAnalyze) {
      try {
        // Download the image from the optimized URL to analyze it
        const response = await fetch(optimizedUrl);
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          const tempFilePath = path.join(tempDir, `temp-${uuidv4()}${path.extname(optimizedUrl)}`);
          fs.writeFileSync(tempFilePath, Buffer.from(imageBuffer));
          
          // Generate listing details from the image
          listingDetails = await imageProcessingService.generateListingDetails(tempFilePath);
          
          // Delete temporary file
          fs.unlinkSync(tempFilePath);
        }
      } catch (analyzeError) {
        console.error('Error auto-analyzing image:', analyzeError);
        // Continue without failing the whole request
      }
    }
    
    res.status(200).json({
      success: true,
      image: imageData,
      listingDetails: listingDetails
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
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Image URL is required' });
    }
    
    // Download image from Supabase URL to temp file
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Failed to download image' });
    }
    
    const imageBuffer = await response.arrayBuffer();
    const tempFilePath = path.join(tempDir, `temp-${uuidv4()}${path.extname(imageUrl)}`);
    fs.writeFileSync(tempFilePath, Buffer.from(imageBuffer));
    
    // Process the image
    const processedImages = await imageProcessingService.processImage(tempFilePath);
    
    // Delete temporary file
    fs.unlinkSync(tempFilePath);
    
    // Return the processed image URLs
    const processedImageUrls = processedImages.map(img => ({
      url: img.publicUrl,
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
 * @route GET /api/images/:id/analyze
 * @desc Analyze an image and generate listing details
 * @access Public
 */
router.get('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ success: false, message: 'Image ID is required' });
    }
    
    // Get the image URL from storage
    const { data: publicUrl } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`uploads/${id}`);
    
    if (!publicUrl || !publicUrl.publicUrl) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    // Download image from URL to temp file
    const response = await fetch(publicUrl.publicUrl);
    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Failed to download image' });
    }
    
    const imageBuffer = await response.arrayBuffer();
    const tempFilePath = path.join(tempDir, `temp-${uuidv4()}${path.extname(id)}`);
    fs.writeFileSync(tempFilePath, Buffer.from(imageBuffer));
    
    // Generate listing details from the image
    const listingDetails = await imageProcessingService.generateListingDetails(tempFilePath);
    
    // Delete temporary file
    fs.unlinkSync(tempFilePath);
    
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
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Filename is required' });
    }
    
    // Delete from Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([`uploads/${filename}`]);
    
    if (error) {
      return res.status(500).json({ success: false, message: `Failed to delete image: ${error.message}` });
    }
    
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: `Image deletion failed: ${error.message}` });
  }
});

/**
 * @route POST /api/images/:id/reanalyze
 * @desc Analyze an image with user-provided context and generate updated listing details
 * @access Public
 */
router.post('/:id/reanalyze', async (req, res) => {
  try {
    const { id } = req.params;
    const { context } = req.body;
    
    if (!id) {
      return res.status(400).json({ success: false, message: 'Image ID is required' });
    }
    
    if (!context || Object.keys(context).length === 0) {
      return res.status(400).json({ success: false, message: 'Context data is required' });
    }
    
    // Get the image URL from storage
    const { data: publicUrl } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`uploads/${id}`);
    
    if (!publicUrl || !publicUrl.publicUrl) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    // Download image from URL to temp file
    const response = await fetch(publicUrl.publicUrl);
    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Failed to download image' });
    }
    
    const imageBuffer = await response.arrayBuffer();
    const tempFilePath = path.join(tempDir, `temp-${uuidv4()}${path.extname(id)}`);
    fs.writeFileSync(tempFilePath, Buffer.from(imageBuffer));
    
    // Generate listing details from the image with context
    const listingDetails = await imageProcessingService.generateListingDetailsWithContext(tempFilePath, context);
    
    // Delete temporary file
    fs.unlinkSync(tempFilePath);
    
    res.status(200).json({
      success: true,
      listingDetails
    });
  } catch (error) {
    console.error('Error analyzing image with context:', error);
    res.status(500).json({ success: false, message: `Image analysis failed: ${error.message}` });
  }
});

module.exports = router; 