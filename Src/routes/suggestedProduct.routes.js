const express = require('express');
const router = express.Router();
const suggestedProductController = require('../controllers/suggestedProduct.controller');
const { verifyToken, authorize } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

// Public routes
router.get('/', suggestedProductController.getAll);
router.get('/:id', suggestedProductController.getById);

// Admin routes
router.post('/', verifyToken, authorize('admin'), upload.single('image'), suggestedProductController.create);
router.put('/:id', verifyToken, authorize('admin'), upload.single('image'), suggestedProductController.update);
router.delete('/:id', verifyToken, authorize('admin'), suggestedProductController.delete);

module.exports = router;
