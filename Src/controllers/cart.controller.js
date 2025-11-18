const Cart = require('../../Models/Cart/Cart.model');

/**
 * Helper: Async wrapper for error handling
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @desc Get user cart
 * @route GET /api/cart
 * @access Public
 */
exports.getCart = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }

  // Calculate total
  const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  res.status(200).json({ 
    success: true, 
    data: {
      ...cart.toObject(),
      total,
      itemCount: cart.items.length
    }
  });
});

/**
 * @desc Add item to cart
 * @route POST /api/cart/add
 * @access Public
 */
exports.addItem = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  
  const { type, productId, quantity = 1, selectedBrand, selectedModel, price } = req.body;
  console.log(req.body);

  if (!productId || !price) {
    return res.status(400).json({ 
      success: false, 
      message: 'Product ID and price are required' 
    });
  }

  if (!type || !['product', 'collection'].includes(type)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Type must be either "product" or "collection"' 
    });
  }

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }

  // Check if same product with same brand/model exists
  const existingItemIndex = cart.items.findIndex(
    item => 
      item.productId === productId && 
      item.selectedBrand === selectedBrand && 
      item.selectedModel === selectedModel
  );

  if (existingItemIndex > -1) {
    // Update quantity
    cart.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    cart.items.push({ 
      type, 
      productId, 
      quantity, 
      selectedBrand: selectedBrand || '', 
      selectedModel: selectedModel || '', 
      price 
    });
  }

  await cart.save();

  const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  res.status(200).json({ 
    success: true, 
    message: existingItemIndex > -1 ? 'Cart updated' : 'Item added to cart', 
    data: {
      itemCount: cart.items.length,
      total
    }
  });
});

/**
 * @desc Update item quantity
 * @route PUT /api/cart/update/:productId
 * @access Public
 */
exports.updateItem = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Valid quantity is required (min: 1)' 
    });
  }

  const cart = await Cart.findOne({ userId });
  if (!cart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });
  }

  const item = cart.items.find((i) => i.productId === productId);
  if (!item) {
    return res.status(404).json({ 
      success: false, 
      message: 'Item not found in cart' 
    });
  }

  item.quantity = quantity;
  await cart.save();

  const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  res.status(200).json({ 
    success: true, 
    message: 'Cart updated', 
    data: {
      itemCount: cart.items.length,
      total
    }
  });
});

/**
 * @desc Remove item from cart
 * @route DELETE /api/cart/remove/:productId
 * @access Public
 */
exports.removeItem = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { productId } = req.params;

  const cart = await Cart.findOneAndUpdate(
    { userId },
    { $pull: { items: { productId } } },
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
    message: 'Item removed', 
    data: {
      itemCount: cart.items.length,
      total
    }
  });
});

/**
 * @desc Clear entire cart
 * @route DELETE /api/cart/clear
 * @access Public
 */
exports.clearCart = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const cart = await Cart.findOneAndUpdate(
    { userId },
    { $set: { items: [] } },
    { new: true }
  );

  if (!cart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });
  }

  res.status(200).json({ 
    success: true, 
    message: 'Cart cleared', 
    data: {
      itemCount: 0,
      total: 0
    }
  });
});

/**
 * @desc Get cart item count
 * @route GET /api/cart/count
 * @access Public
 */
exports.getItemCount = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const cart = await Cart.findOne({ userId });
  const count = cart ? cart.items.reduce((acc, item) => acc + item.quantity, 0) : 0;

  res.status(200).json({ 
    success: true, 
    data: { count } 
  });
});

/**
 * @desc Add to guest cart (returns structure for localStorage)
 * @route POST /api/cart/guest/add
 * @access Public
 */
exports.addToGuestCart = asyncHandler(async (req, res) => {
  const { type, productId, quantity = 1, selectedBrand, selectedModel, price } = req.body;

  if (!productId || !price) {
    return res.status(400).json({ 
      success: false, 
      message: 'Product ID and price are required' 
    });
  }

  res.status(200).json({
    success: true,
    message: 'Item structure for guest cart',
    data: { 
      type,
      productId, 
      quantity, 
      selectedBrand: selectedBrand || '', 
      selectedModel: selectedModel || '', 
      price, 
      addedAt: new Date() 
    },
  });
});

/**
 * Global Error Handler
 */
exports.errorHandler = (err, req, res, next) => {
  console.error('Cart Error:', err);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ 
      success: false, 
      message: 'Validation Error', 
      errors 
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid ID format' 
    });
  }

  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal Server Error' 
  });
};
