const { Router } = require('express');
const controller = require('../controllers/collection.controller');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

// Special routes for managing products in collections
router.post('/:id/products', controller.addProduct);
router.delete('/:id/products', controller.removeProduct);

module.exports = router;
