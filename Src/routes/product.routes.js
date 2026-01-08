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
  upload.single('image1')(req, res, (err) => {
    if (err) {
      console.error('Multer/Cloudinary error:', err);
      return res.status(400).json({ 
        success: false, 
        message: err.message || 'File upload failed',
        error: err.toString()
      });
    }
    console.log('File uploaded successfully, passing to controller');
    next();
  });
}, controller.create);

router.patch('/:id', (req, res, next) => {
  upload.single('image1')(req, res, (err) => {
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
