const { Router } = require('express');
const controller = require('../controllers/designAsset.controller');
const { upload } = require('../config/cloudinary');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', upload.single('image'), controller.create);
router.patch('/:id', upload.single('image'), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
