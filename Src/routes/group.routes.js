const { Router } = require('express');
const controller = require('../controllers/group.controller');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

// Special routes for managing collections in groups
router.post('/:id/collections', controller.addCollection);
router.delete('/:id/collections', controller.removeCollection);

module.exports = router;
