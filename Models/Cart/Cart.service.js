const Cart = require('./Cart.model');
const Product = require('../Products/Product.model');

/**
 * Get user's cart with populated product details
 */
const getCartByUserId = async (userId) => {
  const cart = await Cart.findOne({ userId }).lean();

  if (!cart) {
    return {
      userId,
      items: [],
      totalItems: 0,
      totalPrice: 0
    };
  }

  // Manually populate products using custom ID field
  const populatedItems = await Promise.all(
    cart.items.map(async (item) => {
      const product = await Product.findOne({ id: item.productId }).lean();
      return {
        ...item,
        product: product || null
      };
    })
  );

  // Calculate totals
  const totalItems = populatedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = populatedItems.reduce((sum, item) => {
    const price = item.product?.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  return {
    ...cart,
    items: populatedItems,
    totalItems,
    totalPrice
  };
};

/**
 * Add item to cart
 */
const addToCart = async (userId, productId, quantity = 1, options = {}) => {
  console.log('Adding to cart:', { userId, productId, quantity, options });

  // Find product by custom ID field (not _id)
  const product = await Product.findOne({ id: productId });
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Check stock availability
  if (product.stock !== undefined && product.stock < quantity) {
    throw new Error('Insufficient stock');
  }

  // Find or create cart
  let cart = await Cart.findOne({ userId });

  if (!cart) {
    cart = new Cart({
      userId,
      items: []
    });
  }

  // Check if product already in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.productId === productId
  );

  if (existingItemIndex > -1) {
    // Update quantity if item exists
    cart.items[existingItemIndex].quantity += quantity;
    
    // Update options if provided
    if (options.selectedBrand) {
      cart.items[existingItemIndex].selectedBrand = options.selectedBrand;
    }
    if (options.selectedModel) {
      cart.items[existingItemIndex].selectedModel = options.selectedModel;
    }
  } else {
    // Add new item to cart
    cart.items.push({
      productId: productId, // Store custom ID as string
      quantity,
      selectedBrand: options.selectedBrand || '',
      selectedModel: options.selectedModel || '',
      price: product.price
    });
  }

  await cart.save();

  // Return populated cart
  return await getCartByUserId(userId);
};

/**
 * Update item quantity in cart
 */
const updateCartItem = async (userId, productId, quantity) => {
  if (quantity < 1) {
    throw new Error('Quantity must be at least 1');
  }

  const cart = await Cart.findOne({ userId });
  if (!cart) {
    throw new Error('Cart not found');
  }

  const itemIndex = cart.items.findIndex(
    item => item.productId === productId
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  // Validate stock
  const product = await Product.findOne({ id: productId });
  if (product && product.stock !== undefined && product.stock < quantity) {
    throw new Error('Insufficient stock');
  }

  // Update quantity
  cart.items[itemIndex].quantity = quantity;
  await cart.save();

  return await getCartByUserId(userId);
};

/**
 * Remove item from cart
 */
const removeFromCart = async (userId, productId) => {
  const cart = await Cart.findOne({ userId });
  if (!cart) {
    throw new Error('Cart not found');
  }

  cart.items = cart.items.filter(
    item => item.productId !== productId
  );

  await cart.save();

  return await getCartByUserId(userId);
};

/**
 * Clear entire cart
 */
const clearCart = async (userId) => {
  const cart = await Cart.findOne({ userId });
  if (!cart) {
    throw new Error('Cart not found');
  }

  cart.items = [];
  await cart.save();

  return {
    userId,
    items: [],
    totalItems: 0,
    totalPrice: 0
  };
};

/**
 * Update cart item options (brand, model)
 */
const updateCartItemOptions = async (userId, productId, options) => {
  const cart = await Cart.findOne({ userId });
  if (!cart) {
    throw new Error('Cart not found');
  }

  const itemIndex = cart.items.findIndex(
    item => item.productId === productId
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  // Update options
  if (options.selectedBrand !== undefined) {
    cart.items[itemIndex].selectedBrand = options.selectedBrand;
  }
  if (options.selectedModel !== undefined) {
    cart.items[itemIndex].selectedModel = options.selectedModel;
  }

  await cart.save();

  return await getCartByUserId(userId);
};

/**
 * Merge guest cart with user cart (for when user logs in)
 */
const mergeCart = async (userId, guestCartItems) => {
  if (!guestCartItems || guestCartItems.length === 0) {
    return await getCartByUserId(userId);
  }

  let cart = await Cart.findOne({ userId });

  if (!cart) {
    cart = new Cart({
      userId,
      items: []
    });
  }

  // Merge guest items with user cart
  for (const guestItem of guestCartItems) {
    const existingItemIndex = cart.items.findIndex(
      item => item.productId === guestItem.productId
    );

    if (existingItemIndex > -1) {
      // Add quantities if item exists
      cart.items[existingItemIndex].quantity += guestItem.quantity;
    } else {
      // Add new item
      cart.items.push(guestItem);
    }
  }

  await cart.save();

  return await getCartByUserId(userId);
};

/**
 * Get cart item count
 */
const getCartItemCount = async (userId) => {
  const cart = await Cart.findOne({ userId });
  
  if (!cart) {
    return 0;
  }

  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
};

/**
 * Validate cart before checkout
 */
const validateCart = async (userId) => {
  const cart = await Cart.findOne({ userId });
  
  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const errors = [];
  const validatedItems = [];

  for (const item of cart.items) {
    const product = await Product.findOne({ id: item.productId });

    // Check if product still exists
    if (!product) {
      errors.push({
        item: item._id,
        productId: item.productId,
        error: 'Product no longer available'
      });
      continue;
    }

    // Check stock
    if (product.stock !== undefined && product.stock < item.quantity) {
      errors.push({
        item: item._id,
        productId: item.productId,
        productName: product.name,
        error: `Only ${product.stock} items available`,
        availableStock: product.stock,
        requestedQuantity: item.quantity
      });
    }

    // Check if price changed
    if (item.price !== product.price) {
      errors.push({
        item: item._id,
        productId: item.productId,
        productName: product.name,
        error: 'Price has changed',
        oldPrice: item.price,
        newPrice: product.price
      });
    }

    validatedItems.push({
      ...item.toObject(),
      product
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    cart: await getCartByUserId(userId)
  };
};

module.exports = {
  getCartByUserId,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  updateCartItemOptions,
  mergeCart,
  getCartItemCount,
  validateCart
};

