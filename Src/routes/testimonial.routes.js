const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonial.controller');
const { verifyToken, authorize } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Configure multer for image upload
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 } // Customer image/avatar (optional)
]);

// Public routes (no authentication required)
router.get('/active', testimonialController.getActiveTestimonials);

// Admin routes (authentication required)
router.get('/', verifyToken, authorize('admin'), testimonialController.getAllTestimonials);
router.get('/:id', verifyToken, authorize('admin'), testimonialController.getTestimonialById);
router.post('/', verifyToken, authorize('admin'), uploadFields, testimonialController.createTestimonial);
router.put('/:id', verifyToken, authorize('admin'), uploadFields, testimonialController.updateTestimonial);
router.delete('/:id', verifyToken, authorize('admin'), testimonialController.deleteTestimonial);
router.patch('/:id/toggle-active', verifyToken, authorize('admin'), testimonialController.toggleActiveStatus);
router.patch('/:id/order', verifyToken, authorize('admin'), testimonialController.updateOrder);

module.exports = router;
