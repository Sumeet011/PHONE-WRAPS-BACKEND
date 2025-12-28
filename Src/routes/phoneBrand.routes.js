const express = require('express');
const router = express.Router();
const phoneBrandController = require('../controllers/phoneBrand.controller');

/**
 * @route   GET /api/phone-brands
 * @desc    Get all phone brands
 * @access  Public
 * @query   activeOnly=true - to get only active brands
 */
router.get('/', phoneBrandController.getAllBrands);

/**
 * @route   GET /api/phone-brands/:id
 * @desc    Get phone brand by ID
 * @access  Public
 */
router.get('/:id', phoneBrandController.getBrandById);

/**
 * @route   POST /api/phone-brands
 * @desc    Create new phone brand
 * @access  Private/Admin
 * @body    { brandName, models: [{ modelName }] }
 */
router.post('/', phoneBrandController.createBrand);

/**
 * @route   PUT /api/phone-brands/:id
 * @desc    Update phone brand
 * @access  Private/Admin
 * @body    { brandName?, models?, isActive? }
 */
router.put('/:id', phoneBrandController.updateBrand);

/**
 * @route   POST /api/phone-brands/:id/models
 * @desc    Add model to brand
 * @access  Private/Admin
 * @body    { modelName }
 */
router.post('/:id/models', phoneBrandController.addModel);

/**
 * @route   DELETE /api/phone-brands/:id/models/:modelName
 * @desc    Remove model from brand
 * @access  Private/Admin
 */
router.delete('/:id/models/:modelName', phoneBrandController.removeModel);

/**
 * @route   PATCH /api/phone-brands/:id/toggle-status
 * @desc    Toggle brand active status
 * @access  Private/Admin
 */
router.patch('/:id/toggle-status', phoneBrandController.toggleStatus);

/**
 * @route   DELETE /api/phone-brands/:id
 * @desc    Delete phone brand
 * @access  Private/Admin
 */
router.delete('/:id', phoneBrandController.deleteBrand);

module.exports = router;
