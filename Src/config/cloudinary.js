const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');


// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('✅ Cloudinary configured');

// Configure Multer Storage with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'phone-wraps-products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    format: async (req, file) => {
      // Preserve PNG format for images with transparency
      if (file.mimetype === 'image/png') {
        return 'png';
      }
      return 'jpg';
    },
    transformation: [{ 
      width: 1000, 
      height: 1000, 
      crop: 'limit',
      quality: 'auto',
      flags: 'preserve_transparency' // Preserve alpha channel for PNG images
    }]
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise} - Cloudinary upload result
 */
const uploadToCloudinary = async (filePath, folder = 'uploads') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto'
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

module.exports = { cloudinary, upload, uploadToCloudinary };
