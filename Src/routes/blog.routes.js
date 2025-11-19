const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const { adminAuth } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Configure multer for multiple file uploads
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 }, // Cover/featured image
  { name: 'contentImages', maxCount: 10 } // Multiple content images
]);

// Public routes (no authentication required)
router.get('/', blogController.getAllBlogs);
router.get('/:id', blogController.getBlogById);

// Admin routes (authentication required)
router.post('/', adminAuth, uploadFields, blogController.createBlog);
router.put('/:id', adminAuth, uploadFields, blogController.updateBlog);
router.delete('/:id', adminAuth, blogController.deleteBlog);

module.exports = router;
