const Cart = require('../../Models/Cart/Cart.model');
const { cloudinary } = require('../config/cloudinary');

/**
 * Helper: Async wrapper for error handling
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @desc Upload custom design image to Cloudinary
 * @route POST /api/custom-design/upload
 * @access Public
 */
exports.uploadDesignImage = asyncHandler(async (req, res) => {
  const { imageData } = req.body;

  if (!imageData) {
    return res.status(400).json({
      success: false,
      message: 'Image data is required'
    });
  }

  try {
    // Upload to Cloudinary with minimal processing for maximum speed
    const result = await cloudinary.uploader.upload(imageData, {
      folder: 'custom-designs',
      resource_type: 'image',
      quality: 'auto:eco', // Fastest upload
      fetch_format: 'auto',
      flags: 'lossy' // Enable lossy compression for smaller size
    });

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id
      }
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

/**
 * @desc Add custom design to cart
 * @route POST /api/custom-design/add-to-cart
 * @access Public
 */
exports.addCustomDesignToCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  
  const {
    designImageUrl,
    originalImageUrl,
    phoneModel,
    selectedBrand,
    selectedModel,
    transform,
    price = 499,
    quantity = 1
  } = req.body;

  // Validation
  if (!designImageUrl || !phoneModel || !selectedBrand || !selectedModel) {
    return res.status(400).json({
      success: false,
      message: 'Design image URL, phone model, brand, and model are required'
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  // Find or create cart
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }

  // Generate unique product ID for custom design
  const customProductId = `CUSTOM-${Date.now()}`;

  // Add custom design item to cart
  const customDesignItem = {
    type: 'custom-design',
    productId: customProductId,
    quantity,
    selectedBrand: selectedBrand || 'Custom',
    selectedModel: selectedModel || phoneModel,
    price,
    customDesign: {
      designImageUrl,
      originalImageUrl: originalImageUrl || '',
      phoneModel,
      transform: transform || { x: 0, y: 0, scale: 1, rotation: 0 }
    }
  };

  cart.items.push(customDesignItem);
  await cart.save();

  // Calculate total
  const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  res.status(200).json({
    success: true,
    message: 'Custom design added to cart',
    data: {
      itemCount: cart.items.length,
      total,
      customDesignId: customProductId
    }
  });
});

/**
 * @desc Get all custom designs in user's cart
 * @route GET /api/custom-design/cart
 * @access Public
 */
exports.getCustomDesignsInCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  const cart = await Cart.findOne({ userId });
  
  if (!cart) {
    return res.status(200).json({
      success: true,
      data: {
        customDesigns: [],
        count: 0
      }
    });
  }

  // Filter only custom design items
  const customDesigns = cart.items.filter(item => item.type === 'custom-design');

  res.status(200).json({
    success: true,
    data: {
      customDesigns,
      count: customDesigns.length
    }
  });
});

/**
 * @desc Remove custom design from cart
 * @route DELETE /api/custom-design/cart/:productId
 * @access Public
 */
exports.removeCustomDesignFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  const { productId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  const cart = await Cart.findOneAndUpdate(
    { userId },
    { $pull: { items: { productId, type: 'custom-design' } } },
    { new: true }
  );

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found'
    });
  }

  const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  res.status(200).json({
    success: true,
    message: 'Custom design removed from cart',
    data: {
      itemCount: cart.items.length,
      total
    }
  });
});

/**
 * Error handler middleware
 */
exports.errorHandler = (err, req, res, next) => {
  console.error('Custom Design Error:', err);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
