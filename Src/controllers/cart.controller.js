const Cart = require('../../Models/Cart/Cart.model');
const Product = require('../../Models/Products/Product.model');
const Collection = require('../../Models/Collection/Collection.model');

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

  // Populate product/collection details for each item
  const populatedItems = await Promise.all(
    cart.items.map(async (item) => {
      let productDetails = null;
      const itemObj = item.toObject();
      
      try {
        if (item.type === 'product') {
          // productId is the MongoDB _id as a string
          productDetails = await Product.findById(item.productId).select('name image price').lean();
          if (!productDetails) {
            console.warn(`⚠️ Product not found for ID: ${item.productId}`);
          }
          // Clean up: products shouldn't have customDesign
          delete itemObj.customDesign;
        } else if (item.type === 'collection') {
          productDetails = await Collection.findById(item.productId).select('name heroImage').lean();
          if (!productDetails) {
            console.warn(`⚠️ Collection not found for ID: ${item.productId}`);
          } else {
            // Map heroImage to image for consistent frontend handling
            productDetails.image = productDetails.heroImage;
          }
          // Clean up: collections shouldn't have customDesign
          delete itemObj.customDesign;
        } else if (item.type === 'custom-design') {
          // For custom designs, use the design image from the item itself
          productDetails = {
            name: 'Custom Design',
            image: item.customDesign?.designImageUrl || item.customDesign?.originalImageUrl
          };
          
          if (!productDetails.image) {
            console.warn(`⚠️ Custom design has no image: ${item.productId}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching ${item.type} details for ${item.productId}:`, error.message);
      }
      
      return {
        ...itemObj,
        productDetails
      };
    })
  );

  // Calculate total
  const total = populatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Debug logging
  console.log('Cart items with product details:', JSON.stringify(populatedItems.map(item => ({
    type: item.type,
    productId: item.productId,
    hasProductDetails: !!item.productDetails,
    productName: item.productDetails?.name,
    image: item.productDetails?.image,
    customDesignEmpty: item.type !== 'custom-design' && item.customDesign ? 
      (item.customDesign.designImageUrl === '' && item.customDesign.originalImageUrl === '') : 'N/A'
  })), null, 2));

  res.status(200).json({ 
    success: true, 
    data: {
      userId: cart.userId,
      items: populatedItems,
      total,
      itemCount: cart.items.length,
      appliedCoupons: cart.appliedCoupons || []
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
  
  const { type, productId, quantity = 1, selectedBrand, selectedModel, price, customDesign } = req.body;
  console.log('Adding item to cart:', { type, productId, quantity, selectedBrand, selectedModel });

  if (!productId || !price) {
    return res.status(400).json({ 
      success: false, 
      message: 'Product ID and price are required' 
    });
  }

  if (!type || !['product', 'collection', 'custom-design'].includes(type)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Type must be "product", "collection", or "custom-design"' 
    });
  }

  // Validate custom-design specific requirements
  if (type === 'custom-design' && !customDesign?.designImageUrl) {
    return res.status(400).json({ 
      success: false, 
      message: 'Custom design must include designImageUrl' 
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
    // Add new item with appropriate structure based on type
    const newItem = { 
      type, 
      productId, 
      quantity, 
      selectedBrand: selectedBrand || '', 
      selectedModel: selectedModel || '', 
      price
    };
    
    // Only include customDesign object for custom-design type
    if (type === 'custom-design' && customDesign) {
      newItem.customDesign = {
        designImageUrl: customDesign.designImageUrl || '',
        originalImageUrl: customDesign.originalImageUrl || '',
        phoneModel: customDesign.phoneModel || '',
        transform: customDesign.transform || { x: 0, y: 0, scale: 1, rotation: 0 }
      };
    }
    
    cart.items.push(newItem);
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
 * @desc Apply coupon to cart
 * @route POST /api/cart/coupon/apply
 * @access Public
 */
exports.applyCoupon = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { code, discountPercentage, discountAmount } = req.body;

  if (!code || !discountPercentage || !discountAmount) {
    return res.status(400).json({ 
      success: false, 
      message: 'Coupon code, discount percentage, and discount amount are required' 
    });
  }

  const cart = await Cart.findOne({ userId });
  if (!cart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });
  }

  // Check if coupon already applied
  const alreadyApplied = cart.appliedCoupons.some(
    c => c.code.toUpperCase() === code.toUpperCase()
  );

  if (alreadyApplied) {
    return res.status(400).json({ 
      success: false, 
      message: 'This coupon is already applied' 
    });
  }

  // Add coupon to cart
  cart.appliedCoupons.push({
    code: code.toUpperCase(),
    discountPercentage,
    discountAmount
  });

  await cart.save();

  res.status(200).json({ 
    success: true, 
    message: 'Coupon applied successfully',
    data: {
      appliedCoupons: cart.appliedCoupons
    }
  });
});

/**
 * @desc Remove coupon from cart
 * @route DELETE /api/cart/coupon/remove/:code
 * @access Public
 */
exports.removeCoupon = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { code } = req.params;

  const cart = await Cart.findOne({ userId });
  if (!cart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });
  }

  // Remove coupon from cart
  cart.appliedCoupons = cart.appliedCoupons.filter(
    c => c.code.toUpperCase() !== code.toUpperCase()
  );

  await cart.save();

  res.status(200).json({ 
    success: true, 
    message: 'Coupon removed successfully',
    data: {
      appliedCoupons: cart.appliedCoupons
    }
  });
});

/**
 * @desc Get all applied coupons
 * @route GET /api/cart/coupons
 * @access Public
 */
exports.getAppliedCoupons = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const cart = await Cart.findOne({ userId });
  if (!cart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });
  }

  res.status(200).json({ 
    success: true, 
    data: {
      appliedCoupons: cart.appliedCoupons || []
    }
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
