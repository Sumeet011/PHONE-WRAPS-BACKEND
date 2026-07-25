const express = require('express');
const router = express.Router();
const featuredHomeProductController = require('../controllers/featuredHomeProduct.controller');
const { verifyToken, authorize } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

// Public routes
router.get('/', featuredHomeProductController.getAll);
router.get('/:id', featuredHomeProductController.getById);

// Admin routes
router.post('/', verifyToken, authorize('admin'), upload.single('image'), featuredHomeProductController.create);
router.put('/:id', verifyToken, authorize('admin'), upload.single('image'), featuredHomeProductController.update);
router.delete('/:id', verifyToken, authorize('admin'), featuredHomeProductController.delete);

module.exports = router;
