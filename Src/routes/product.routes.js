const { Router } = require('express');
const controller = require('../controllers/product.controller');
const { upload } = require('../config/cloudinary');

const router = Router();

// Test endpoint
router.post('/test', (req, res) => {
  console.log('TEST ENDPOINT HIT');
  res.json({ success: true, message: 'Test endpoint working' });
});

router.get('/', controller.list);
router.get('/:id', controller.getById);

// Add error handling for multer
router.post('/', (req, res, next) => {
  console.log('POST /api/products hit - before multer');
  console.log('Content-Type:', req.headers['content-type']);
  
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      console.error('Multer/Cloudinary error:', err);
      console.error('Error stack:', err.stack);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        name: err.name,
        storageErrors: err.storageErrors
      });
      return res.status(400).json({ 
        success: false, 
        message: err.message || 'File upload failed',
        error: err.toString()
      });
    }
    console.log('Files uploaded successfully:', req.files ? Object.keys(req.files) : 'none');
    console.log('Body keys after multer:', req.body ? Object.keys(req.body) : 'none');
    next();
  });
}, controller.create);

router.patch('/:id', (req, res, next) => {
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      console.error('Multer/Cloudinary error on update:', err);
      return res.status(400).json({ 
        success: false, 
        message: err.message || 'File upload failed',
        error: err.toString()
      });
    }
    next();
  });
}, controller.update);

router.delete('/:id', controller.remove);

module.exports = router;
