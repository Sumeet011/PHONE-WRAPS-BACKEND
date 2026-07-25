const suggestedProductService = require('../../Models/SuggestedProduct/SuggestedProduct.service');
const { uploadToCloudinary } = require('../config/cloudinary');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Create suggested product
exports.create = asyncHandler(async (req, res) => {
  const { name, price, description, displayOrder, isActive } = req.body;

  if (!name || !price) {
    return res.status(400).json({
      success: false,
      message: 'Name and price are required'
    });
  }

  const data = {
    name,
    price: Number(price),
    description,
    displayOrder: displayOrder ? Number(displayOrder) : 0,
    isActive: isActive !== undefined ? isActive : true
  };

  // Handle image upload if provided
  if (req.file) {
    const result = await uploadToCloudinary(req.file.path, 'suggested-products');
    data.image = result.secure_url;
  }

  const suggestedProduct = await suggestedProductService.createSuggestedProduct(data);

  res.status(201).json({
    success: true,
    message: 'Suggested product created successfully',
    data: suggestedProduct
  });
});

// Get all suggested products
exports.getAll = asyncHandler(async (req, res) => {
  const { activeOnly } = req.query;
  const filter = activeOnly === 'true' ? { isActive: true } : {};

  const suggestedProducts = await suggestedProductService.getAllSuggestedProducts(filter);

  res.status(200).json({
    success: true,
    count: suggestedProducts.length,
    data: suggestedProducts
  });
});

// Get suggested product by ID
exports.getById = asyncHandler(async (req, res) => {
  const suggestedProduct = await suggestedProductService.getSuggestedProductById(req.params.id);

  res.status(200).json({
    success: true,
    data: suggestedProduct
  });
});

// Update suggested product
exports.update = asyncHandler(async (req, res) => {
  const { name, price, description, displayOrder, isActive } = req.body;

  const updateData = {};
  if (name) updateData.name = name;
  if (price) updateData.price = Number(price);
  if (description !== undefined) updateData.description = description;
  if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);
  if (isActive !== undefined) updateData.isActive = isActive;

  // Handle image upload if provided
  if (req.file) {
    const result = await uploadToCloudinary(req.file.path, 'suggested-products');
    updateData.image = result.secure_url;
  }

  const suggestedProduct = await suggestedProductService.updateSuggestedProduct(req.params.id, updateData);

  res.status(200).json({
    success: true,
    message: 'Suggested product updated successfully',
    data: suggestedProduct
  });
});

// Delete suggested product
exports.delete = asyncHandler(async (req, res) => {
  await suggestedProductService.deleteSuggestedProduct(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Suggested product deleted successfully'
  });
});
