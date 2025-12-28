const asyncHandler = require('express-async-handler');
const phoneBrandService = require('../../Models/PhoneBrand/PhoneBrand.service');

/**
 * @desc Get all phone brands
 * @route GET /api/phone-brands
 * @access Public
 */
exports.getAllBrands = asyncHandler(async (req, res) => {
    const activeOnly = req.query.activeOnly === 'true';
    const brands = await phoneBrandService.getAllBrands(activeOnly);

    res.status(200).json({
        success: true,
        count: brands.length,
        data: brands
    });
});

/**
 * @desc Get phone brand by ID
 * @route GET /api/phone-brands/:id
 * @access Public
 */
exports.getBrandById = asyncHandler(async (req, res) => {
    const brand = await phoneBrandService.getBrandById(req.params.id);

    res.status(200).json({
        success: true,
        data: brand
    });
});



/**
 * @desc Create new phone brand
 * @route POST /api/phone-brands
 * @access Private/Admin
 */
exports.createBrand = asyncHandler(async (req, res) => {
    const { brandName, models } = req.body;

    if (!brandName) {
        return res.status(400).json({
            success: false,
            message: 'Brand name is required'
        });
    }

    const brand = await phoneBrandService.createBrand({
        brandName,
        models: models || []
    });

    res.status(201).json({
        success: true,
        message: 'Phone brand created successfully',
        data: brand
    });
});

/**
 * @desc Update phone brand
 * @route PUT /api/phone-brands/:id
 * @access Private/Admin
 */
exports.updateBrand = asyncHandler(async (req, res) => {
    const { brandName, models, isActive } = req.body;

    const brand = await phoneBrandService.updateBrand(req.params.id, {
        brandName,
        models,
        isActive
    });

    res.status(200).json({
        success: true,
        message: 'Phone brand updated successfully',
        data: brand
    });
});

/**
 * @desc Add model to brand
 * @route POST /api/phone-brands/:id/models
 * @access Private/Admin
 */
exports.addModel = asyncHandler(async (req, res) => {
    const { modelName } = req.body;

    if (!modelName) {
        return res.status(400).json({
            success: false,
            message: 'Model name is required'
        });
    }

    const brand = await phoneBrandService.addModelToBrand(req.params.id, {
        modelName
    });

    res.status(200).json({
        success: true,
        message: 'Model added successfully',
        data: brand
    });
});

/**
 * @desc Remove model from brand
 * @route DELETE /api/phone-brands/:id/models/:modelCode
 * @access Private/Admin
 */
exports.removeModel = asyncHandler(async (req, res) => {
    const brand = await phoneBrandService.removeModelFromBrand(
        req.params.id,
        req.params.modelName
    );

    res.status(200).json({
        success: true,
        message: 'Model removed successfully',
        data: brand
    });
});

/**
 * @desc Delete phone brand
 * @route DELETE /api/phone-brands/:id
 * @access Private/Admin
 */
exports.deleteBrand = asyncHandler(async (req, res) => {
    await phoneBrandService.deleteBrand(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Phone brand deleted successfully'
    });
});

/**
 * @desc Toggle brand active status
 * @route PATCH /api/phone-brands/:id/toggle-status
 * @access Private/Admin
 */
exports.toggleStatus = asyncHandler(async (req, res) => {
    const brand = await phoneBrandService.toggleBrandStatus(req.params.id);

    res.status(200).json({
        success: true,
        message: `Brand ${brand.isActive ? 'activated' : 'deactivated'} successfully`,
        data: brand
    });
});
