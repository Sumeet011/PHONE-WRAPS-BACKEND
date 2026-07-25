const Cart = require('./Cart.model');
const Product = require('../Products/Product.model');
const Collection = require('../Collection/Collection.model');
const SuggestedProduct = require('../SuggestedProduct/SuggestedProduct.model');

/**
 * Custom Error Classes for better error handling
 */
class CartError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CartError';
    this.statusCode = statusCode;
  }
}

class ProductNotFoundError extends CartError {
  constructor(message = 'Product not found') {
    super(message, 404);
    this.name = 'ProductNotFoundError';
  }
}

class InsufficientStockError extends CartError {
  constructor(available, requested) {
    super(`Insufficient stock. Only ${available} items available, but ${requested} requested`, 400);
    this.name = 'InsufficientStockError';
    this.available = available;
    this.requested = requested;
  }
}

/**
 * Helper: Get product reference model based on type
 */
const getProductModel = (type) => {
  switch (type) {
    case 'product':
      return { model: Product, ref: 'Product' };
    case 'collection':
      return { model: Collection, ref: 'Collection' };
    case 'suggested':
      return { model: SuggestedProduct, ref: 'SuggestedProduct' };
    default:
      return null;
  }
};

/**
 * Helper: Validate and fetch product
 */
const validateProduct = async (type, productId, quantity) => {
  if (type === 'custom-design') {
    return null; // Custom designs don't need validation
  }

  const { model, ref } = getProductModel(type) || {};
  if (!model) {
    throw new CartError(`Invalid product type: ${type}`);
  }

  const product = await model.findById(productId).lean();
  if (!product) {
    throw new ProductNotFoundError(`${ref} with ID ${productId} not found`);
  }

  // Validate stock for products
  if (type === 'product' && product.quantity !== undefined) {
    if (product.quantity < quantity) {
      throw new InsufficientStockError(product.quantity, quantity);
    }
  }

  return { product, ref };
};

/**
 * Get user's cart with populated product details
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cart with populated items and calculated totals
 */
const getCartByUserId = async (userId) => {
  try {
    if (!userId) {
      throw new CartError('User ID is required');
    }

    const cart = await Cart.findOne({ userId }).lean();

    if (!cart) {
      return {
        userId,
        items: [],
        appliedCoupons: [],
        totals: {
          subtotal: 0,
          totalDiscount: 0,
          total: 0,
          itemCount: 0,
        },
      };
    }

    // Populate product details for each item
    const populatedItems = await Promise.all(
      cart.items.map(async (item) => {
        if (item.type === 'custom-design') {
          return { ...item, product: null };
        }

        const { model } = getProductModel(item.type) || {};
        if (!model) return { ...item, product: null };

        const product = await model.findById(item.productId).lean();
        return { ...item, product };
      })
    );

    // Calculate totals
    const subtotal = populatedItems.reduce((sum, item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      const plateTotal = (item.platePrice || 0) * (item.plateQuantity || 0);
      return sum + itemTotal + plateTotal;
    }, 0);

    const totalDiscount = cart.appliedCoupons.reduce(
      (sum, coupon) => sum + (coupon.discountAmount || 0),
      0
    );

    const total = Math.max(0, subtotal - totalDiscount);
    const itemCount = populatedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    return {
      ...cart,
      items: populatedItems,
      totals: {
        subtotal: Math.round(subtotal * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        total: Math.round(total * 100) / 100,
        itemCount,
      },
    };
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to retrieve cart: ${error.message}`, 500);
  }
};

/**
 * Add item to cart
 * @param {string} userId - User ID
 * @param {string} type - Item type (product, collection, custom-design, suggested)
 * @param {string} productId - Product/Collection ID
 * @param {number} quantity - Quantity to add
 * @param {Object} options - Additional options (selectedBrand, selectedModel, price, customDesign, etc.)
 * @returns {Promise<Object>} Updated cart
 */
const addToCart = async (userId, type, productId, quantity = 1, options = {}) => {
  try {
    // Validate inputs
    if (!userId) throw new CartError('User ID is required');
    if (!type) throw new CartError('Item type is required');
    if (!productId && type !== 'custom-design') throw new CartError('Product ID is required');
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CartError('Quantity must be a positive integer');
    }
    if (quantity > 999) throw new CartError('Quantity cannot exceed 999');

    // Validate type
    const validTypes = ['product', 'collection', 'custom-design', 'suggested'];
    if (!validTypes.includes(type)) {
      throw new CartError(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    let price = options.price || 0;
    let productRef = null;

    // Validate and fetch product details
    if (type !== 'custom-design') {
      const { product, ref } = await validateProduct(type, productId, quantity);
      productRef = ref;

      // Use product price if not provided in options
      if (!options.price) {
        if (type === 'collection') {
          // Use flat price structure after migration
          price = product.price || 299; // Default collection price
        } else {
          price = product.price || 0;
        }
      }
    } else {
      // Custom design validation
      if (!options.customDesign?.designImageUrl) {
        throw new CartError('Custom design requires designImageUrl');
      }
      price = options.price || 499; // Default custom design price
    }

    if (price < 0) throw new CartError('Price cannot be negative');

    // Find or create cart
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        appliedCoupons: [],
      });
    }

    // Check if same item with same configuration already exists
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId?.toString() === productId?.toString() &&
        item.type === type &&
        item.selectedBrand === (options.selectedBrand || '') &&
        item.selectedModel === (options.selectedModel || '') &&
        item.productOption === (options.productOption || 'none')
    );

    if (existingItemIndex > -1) {
      // Update quantity if item exists
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > 999) {
        throw new CartError('Total quantity cannot exceed 999');
      }

      // Re-validate stock for updated quantity
      if (type === 'product') {
        await validateProduct(type, productId, newQuantity);
      }

      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item to cart
      const newItem = {
        type,
        productId: type === 'custom-design' ? undefined : productId,
        productRef,
        quantity,
        selectedBrand: options.selectedBrand || '',
        selectedModel: options.selectedModel || '',
        price,
        plateQuantity: options.plateQuantity || 0,
        platePrice: options.platePrice || 0,
        productOption: options.productOption || 'none',
        collectionType: options.collectionType || 'none',
      };

      // Add custom design data for custom-design type
      if (type === 'custom-design' && options.customDesign) {
        newItem.customDesign = {
          designImageUrl: options.customDesign.designImageUrl || '',
          originalImageUrl: options.customDesign.originalImageUrl || '',
          phoneModel: options.customDesign.phoneModel || '',
          transform: options.customDesign.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
        };
      }

      cart.items.push(newItem);
    }

    await cart.save();

    // Return populated cart
    return await getCartByUserId(userId);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to add item to cart: ${error.message}`, 500);
  }
};/**
 * Update item quantity in cart
 * @param {string} userId - User ID
 * @param {string} itemId - Cart item ID
 * @param {number} quantity - New quantity
 * @returns {Promise<Object>} Updated cart
 */
const updateCartItem = async (userId, itemId, quantity) => {
  try {
    if (!userId) throw new CartError('User ID is required');
    if (!itemId) throw new CartError('Item ID is required');
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CartError('Quantity must be a positive integer');
    }
    if (quantity > 999) throw new CartError('Quantity cannot exceed 999');

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new CartError('Cart not found', 404);
    }

    const item = cart.items.id(itemId);
    if (!item) {
      throw new CartError('Item not found in cart', 404);
    }

    // Validate stock for products
    if (item.type === 'product' && item.productId) {
      await validateProduct(item.type, item.productId, quantity);
    }

    // Update quantity
    item.quantity = quantity;
    await cart.save();

    return await getCartByUserId(userId);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to update cart item: ${error.message}`, 500);
  }
};

/**
 * Remove item from cart
 * @param {string} userId - User ID
 * @param {string} itemId - Cart item ID
 * @returns {Promise<Object>} Updated cart
 */
const removeFromCart = async (userId, itemId) => {
  try {
    if (!userId) throw new CartError('User ID is required');
    if (!itemId) throw new CartError('Item ID is required');

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new CartError('Cart not found', 404);
    }

    const itemExists = cart.items.id(itemId);
    if (!itemExists) {
      throw new CartError('Item not found in cart', 404);
    }

    // Use pull to remove the item
    cart.items.pull(itemId);
    await cart.save();

    return await getCartByUserId(userId);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to remove item from cart: ${error.message}`, 500);
  }
};

/**
 * Clear entire cart
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Empty cart
 */
const clearCart = async (userId) => {
  try {
    if (!userId) throw new CartError('User ID is required');

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return {
        userId,
        items: [],
        appliedCoupons: [],
        totals: {
          subtotal: 0,
          totalDiscount: 0,
          total: 0,
          itemCount: 0,
        },
      };
    }

    cart.items = [];
    cart.appliedCoupons = [];
    await cart.save();

    return await getCartByUserId(userId);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to clear cart: ${error.message}`, 500);
  }
};

/**
 * Update cart item options (brand, model, plate quantity)
 * @param {string} userId - User ID
 * @param {string} itemId - Cart item ID
 * @param {Object} options - Options to update
 * @returns {Promise<Object>} Updated cart
 */
const updateCartItemOptions = async (userId, itemId, options) => {
  try {
    if (!userId) throw new CartError('User ID is required');
    if (!itemId) throw new CartError('Item ID is required');
    if (!options || typeof options !== 'object') {
      throw new CartError('Options must be an object');
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new CartError('Cart not found', 404);
    }

    const item = cart.items.id(itemId);
    if (!item) {
      throw new CartError('Item not found in cart', 404);
    }

    // Update allowed options
    if (options.selectedBrand !== undefined) {
      item.selectedBrand = options.selectedBrand || '';
    }
    if (options.selectedModel !== undefined) {
      item.selectedModel = options.selectedModel || '';
    }
    if (options.plateQuantity !== undefined) {
      if (!Number.isInteger(options.plateQuantity) || options.plateQuantity < 0) {
        throw new CartError('Plate quantity must be a non-negative integer');
      }
      item.plateQuantity = options.plateQuantity;
    }
    if (options.platePrice !== undefined) {
      if (typeof options.platePrice !== 'number' || options.platePrice < 0) {
        throw new CartError('Plate price must be a non-negative number');
      }
      item.platePrice = options.platePrice;
    }

    await cart.save();

    return await getCartByUserId(userId);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to update cart item options: ${error.message}`, 500);
  }
};

/**
 * Merge guest cart with user cart (for when user logs in)
 * @param {string} userId - User ID
 * @param {Array} guestCartItems - Guest cart items
 * @returns {Promise<Object>} Merged cart
 */
const mergeCart = async (userId, guestCartItems) => {
  try {
    if (!userId) throw new CartError('User ID is required');

    if (!guestCartItems || !Array.isArray(guestCartItems) || guestCartItems.length === 0) {
      return await getCartByUserId(userId);
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        appliedCoupons: [],
      });
    }

    // Merge guest items with user cart
    for (const guestItem of guestCartItems) {
      const existingItemIndex = cart.items.findIndex(
        (item) =>
          item.productId?.toString() === guestItem.productId?.toString() &&
          item.type === guestItem.type &&
          item.selectedBrand === (guestItem.selectedBrand || '') &&
          item.selectedModel === (guestItem.selectedModel || '')
      );

      if (existingItemIndex > -1) {
        // Add quantities if item exists
        const newQuantity = cart.items[existingItemIndex].quantity + (guestItem.quantity || 1);
        cart.items[existingItemIndex].quantity = Math.min(newQuantity, 999);
      } else {
        // Add new item (ensure it's valid)
        if (guestItem.type && guestItem.price !== undefined) {
          cart.items.push({
            type: guestItem.type,
            productId: guestItem.productId,
            productRef: guestItem.productRef,
            quantity: Math.min(guestItem.quantity || 1, 999),
            selectedBrand: guestItem.selectedBrand || '',
            selectedModel: guestItem.selectedModel || '',
            price: guestItem.price || 0,
            plateQuantity: guestItem.plateQuantity || 0,
            platePrice: guestItem.platePrice || 0,
            customDesign: guestItem.customDesign,
          });
        }
      }
    }

    await cart.save();

    return await getCartByUserId(userId);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to merge carts: ${error.message}`, 500);
  }
};

/**
 * Get cart item count
 * @param {string} userId - User ID
 * @returns {Promise<number>} Total item count
 */
const getCartItemCount = async (userId) => {
  try {
    if (!userId) throw new CartError('User ID is required');

    const cart = await Cart.findOne({ userId }).select('items').lean();

    if (!cart || !cart.items) {
      return 0;
    }

    return cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to get cart item count: ${error.message}`, 500);
  }
};

/**
 * Validate cart before checkout
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Validation result with errors if any
 */
const validateCart = async (userId) => {
  try {
    if (!userId) throw new CartError('User ID is required');

    const cart = await Cart.findOne({ userId });

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new CartError('Cart is empty');
    }

    const errors = [];
    const validatedItems = [];

    for (const item of cart.items) {
      // Skip custom designs
      if (item.type === 'custom-design') {
        validatedItems.push({ ...item.toObject(), product: null });
        continue;
      }

      const { model } = getProductModel(item.type) || {};
      if (!model) {
        errors.push({
          itemId: item._id,
          error: `Invalid item type: ${item.type}`,
        });
        continue;
      }

      const product = await model.findById(item.productId).lean();

      // Check if product still exists
      if (!product) {
        errors.push({
          itemId: item._id,
          productId: item.productId,
          error: 'Product no longer available',
        });
        continue;
      }

      // Check stock for products
      if (item.type === 'product' && product.quantity !== undefined) {
        if (product.quantity < item.quantity) {
          errors.push({
            itemId: item._id,
            productId: item.productId,
            productName: product.name,
            error: `Only ${product.quantity} items available`,
            availableStock: product.quantity,
            requestedQuantity: item.quantity,
          });
        }
      }

      // Check if price changed
      const currentPrice = item.type === 'collection'
        ? product.price
        : product.price;

      if (currentPrice !== undefined && item.price !== currentPrice) {
        errors.push({
          itemId: item._id,
          productId: item.productId,
          productName: product.name,
          error: 'Price has changed',
          oldPrice: item.price,
          newPrice: currentPrice,
        });
      }

      validatedItems.push({
        ...item.toObject(),
        product,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      cart: await getCartByUserId(userId),
    };
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to validate cart: ${error.message}`, 500);
  }
};

/**
 * Apply coupon to cart
 * @param {string} userId - User ID
 * @param {string} couponCode - Coupon code
 * @returns {Promise<Object>} Updated cart
 */
const applyCoupon = async (userId, couponCode) => {
  try {
    if (!userId) throw new CartError('User ID is required');
    if (!couponCode) throw new CartError('Coupon code is required');

    const Coupon = require('../Coupon/Coupon.model');

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new CartError('Cart not found', 404);
    }

    if (cart.items.length === 0) {
      throw new CartError('Cannot apply coupon to empty cart');
    }

    // Check if coupon already applied
    const alreadyApplied = cart.appliedCoupons.find(
      (c) => c.code.toUpperCase() === couponCode.toUpperCase()
    );
    if (alreadyApplied) {
      throw new CartError('Coupon already applied');
    }

    // Find and validate coupon
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon) {
      throw new CartError('Invalid coupon code', 404);
    }

    if (!coupon.isActive) {
      throw new CartError('Coupon is not active');
    }

    if (coupon.expiryDate && coupon.expiryDate < new Date()) {
      throw new CartError('Coupon has expired');
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new CartError('Coupon usage limit reached');
    }

    // Calculate cart subtotal
    const subtotal = cart.items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const plateTotal = item.platePrice * item.plateQuantity;
      return sum + itemTotal + plateTotal;
    }, 0);

    // Check minimum order amount
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      throw new CartError(`Minimum order amount of ₹${coupon.minOrderAmount} required`);
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else if (coupon.discountType === 'fixed') {
      discountAmount = Math.min(coupon.discountValue, subtotal);
    }

    // Apply coupon to cart
    cart.appliedCoupons.push({
      code: coupon.code,
      discountPercentage: coupon.discountType === 'percentage' ? coupon.discountValue : 0,
      discountAmount: Math.round(discountAmount * 100) / 100,
      appliedAt: new Date(),
    });

    await cart.save();

    return await getCartByUserId(userId);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to apply coupon: ${error.message}`, 500);
  }
};

/**
 * Remove coupon from cart
 * @param {string} userId - User ID
 * @param {string} couponCode - Coupon code
 * @returns {Promise<Object>} Updated cart
 */
const removeCoupon = async (userId, couponCode) => {
  try {
    if (!userId) throw new CartError('User ID is required');
    if (!couponCode) throw new CartError('Coupon code is required');

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new CartError('Cart not found', 404);
    }

    const initialLength = cart.appliedCoupons.length;
    cart.appliedCoupons = cart.appliedCoupons.filter(
      (c) => c.code.toUpperCase() !== couponCode.toUpperCase()
    );

    if (cart.appliedCoupons.length === initialLength) {
      throw new CartError('Coupon not found in cart', 404);
    }

    await cart.save();

    return await getCartByUserId(userId);
  } catch (error) {
    if (error instanceof CartError) throw error;
    throw new CartError(`Failed to remove coupon: ${error.message}`, 500);
  }
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
  validateCart,
  applyCoupon,
  removeCoupon,
  // Export error classes for use in controllers
  CartError,
  ProductNotFoundError,
  InsufficientStockError,
};

