const { Router } = require('express');
const controller = require('../controllers/collection.controller');
const { upload } = require('../config/cloudinary');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);

// Add multer middleware for hero image upload
router.post('/', upload.single('heroImage'), controller.create);
router.patch('/:id', upload.single('heroImage'), controller.update);
router.delete('/:id', controller.remove);

// Special routes for managing products in collections
router.post('/:id/products', controller.addProduct);
router.delete('/:id/products', controller.removeProduct);

module.exports = router;
