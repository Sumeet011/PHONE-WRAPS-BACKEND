const featuredHomeProductService = require('../../Models/FeaturedHomeProduct/FeaturedHomeProduct.service');
const { uploadToCloudinary } = require('../config/cloudinary');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Create featured home product
exports.create = asyncHandler(async (req, res) => {
    const { name, displayOrder, isActive } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: 'Name is required'
        });
    }

    // Check if already have 2 active products
    const activeCount = await featuredHomeProductService.countActiveFeaturedProducts();
    if (activeCount >= 2 && (isActive === undefined || isActive === true || isActive === 'true')) {
        return res.status(400).json({
            success: false,
            message: 'Maximum 2 active featured products allowed'
        });
    }

    const data = {
        name,
        displayOrder: displayOrder ? Number(displayOrder) : 0,
        isActive: isActive !== undefined ? isActive : true
    };

    // Handle image upload
    if (req.file) {
        const result = await uploadToCloudinary(req.file.path, 'featured-home-products');
        data.image = result.secure_url;
    } else {
        return res.status(400).json({
            success: false,
            message: 'Image is required'
        });
    }

    const product = await featuredHomeProductService.createFeaturedHomeProduct(data);

    res.status(201).json({
        success: true,
        message: 'Featured home product created successfully',
        data: product
    });
});

// Get all featured home products
exports.getAll = asyncHandler(async (req, res) => {
    const { activeOnly, limit } = req.query;
    
    let filter = {};
    if (activeOnly === 'true') {
        filter.isActive = true;
    }

    let products = await featuredHomeProductService.getAllFeaturedHomeProducts(filter);
    
    if (limit) {
        products = products.slice(0, parseInt(limit));
    }

    res.status(200).json({
        success: true,
        data: products
    });
});

// Get by ID
exports.getById = asyncHandler(async (req, res) => {
    const product = await featuredHomeProductService.getFeaturedHomeProductById(req.params.id);

    res.status(200).json({
        success: true,
        data: product
    });
});

// Update featured home product
exports.update = asyncHandler(async (req, res) => {
    const { name, displayOrder, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);
    if (isActive !== undefined) updateData.isActive = isActive;

    // Handle image upload if provided
    if (req.file) {
        const result = await uploadToCloudinary(req.file.path, 'featured-home-products');
        updateData.image = result.secure_url;
    }

    const product = await featuredHomeProductService.updateFeaturedHomeProduct(req.params.id, updateData);

    res.status(200).json({
        success: true,
        message: 'Featured home product updated successfully',
        data: product
    });
});

// Delete featured home product
exports.delete = asyncHandler(async (req, res) => {
    await featuredHomeProductService.deleteFeaturedHomeProduct(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Featured home product deleted successfully'
    });
});
