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
console.log(cloudinary.cloud_name)

// Configure Multer Storage with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    try {
      console.log('Processing file upload:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        fieldname: file.fieldname
      });
      
      // Validate file mimetype
      if (!file.mimetype.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }
      
      // Determine format based on mimetype
      let format = 'jpg';
      if (file.mimetype === 'image/png') {
        format = 'png';
      } else if (file.mimetype === 'image/webp') {
        format = 'webp';
      }
      
      return {
        folder: 'phone-wraps-products',
        format: format,
        transformation: [{ 
          width: 1000, 
          height: 1000, 
          crop: 'limit',
          quality: 'auto',
          flags: 'preserve_transparency' // Preserve alpha channel for PNG images
        }]
      };
    } catch (error) {
      console.error('CloudinaryStorage params error:', error);
      throw error;
    }
  }
});

// File filter to validate file types
const fileFilter = (req, file, cb) => {
  console.log('File filter checking:', file.originalname, 'mimetype:', file.mimetype);
  
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only image files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
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
