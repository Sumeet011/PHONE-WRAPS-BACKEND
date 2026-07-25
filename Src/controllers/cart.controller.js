const Cart = require('../../Models/Cart/Cart.model');
const Product = require('../../Models/Products/Product.model');
const Collection = require('../../Models/Collection/Collection.model');
const SuggestedProduct = require('../../Models/SuggestedProduct/SuggestedProduct.model');
const PhoneBrand = require('../../Models/PhoneBrand/PhoneBrand.model');

const VALID_PRODUCT_OPTIONS = ['cover+plates', 'plates-only', 'cover-only', 'none'];

const toNonNegativeInt = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.floor(num));
};

const normalizeItemByOption = ({ quantity, plateQuantity, productOption, price }) => {
  const option = VALID_PRODUCT_OPTIONS.includes(productOption) ? productOption : 'none';
  const qty = Math.max(1, toNonNegativeInt(quantity, 1));
  const extraPlates = toNonNegativeInt(plateQuantity, 0);
  const unitPrice = Number(price) || 0;

  if (option === 'plates-only') {
    const totalPlates = extraPlates > 0 ? extraPlates : qty;
    return {
      option,
      storedQuantity: 1,
      storedPlateQuantity: totalPlates,
      storedPrice: 0,
      coverUnits: 0,
      plateUnits: totalPlates,
    };
  }

  if (option === 'cover+plates') {
    return {
      option,
      storedQuantity: qty,
      storedPlateQuantity: extraPlates,
      storedPrice: unitPrice,
      coverUnits: qty,
      plateUnits: qty + extraPlates,
    };
  }

  if (option === 'cover-only') {
    return {
      option,
      storedQuantity: qty,
      storedPlateQuantity: 0,
      storedPrice: unitPrice,
      coverUnits: qty,
      plateUnits: 0,
    };
  }

  return {
    option,
    storedQuantity: qty,
    storedPlateQuantity: extraPlates,
    storedPrice: unitPrice,
    coverUnits: qty,
    plateUnits: extraPlates,
  };
};

/**
 * Helper: Check inventory availability
 */
const checkInventoryAvailability = async (item) => {
  const { 
    type, 
    productId, 
    selectedBrand, 
    selectedModel, 
    quantity, 
    plateQuantity, 
    productOption,
    collectionType 
  } = item;

  const normalized = normalizeItemByOption({
    quantity,
    plateQuantity,
    productOption,
    price: item.price,
  });
  
  if (!selectedBrand || !selectedModel) {
    return { available: true }; // Skip check if no brand/model specified
  }
  
  try {
    let itemCollectionType = collectionType;
    
    // Determine collection type if not provided
    if (!itemCollectionType || itemCollectionType === 'none') {
      if (type === 'collection') {
        const collection = await Collection.findById(productId);
        if (collection) {
          itemCollectionType = collection.type;
        }
      } else if (type === 'product') {
        const product = await Product.findById(productId);
        if (product) {
          itemCollectionType = product.type;
        }
      }
    }
    
    // Check inventory based on collection type
    if (itemCollectionType === 'gaming' || itemCollectionType === 'custom' || itemCollectionType === 'swap-wrap') {
      // Check PhoneBrand inventory
      const phoneBrand = await PhoneBrand.findOne({ brandName: selectedBrand });
      
      if (!phoneBrand) {
        return { 
          available: false, 
          message: `Phone brand "${selectedBrand}" not found in inventory` 
        };
      }
      
      const phoneModel = phoneBrand.models.find(m => m.modelName === selectedModel);
      
      if (!phoneModel) {
        return { 
          available: false, 
          message: `Phone model "${selectedModel}" not found for brand "${selectedBrand}"` 
        };
      }
      
      if (normalized.coverUnits > 0 && phoneModel.backCoversCount < normalized.coverUnits) {
        return {
          available: false,
          message: `Insufficient covers available. Required: ${normalized.coverUnits}, Available: ${phoneModel.backCoversCount}`,
        };
      }

      if (normalized.plateUnits > 0 && phoneModel.aluminumSheetsCount < normalized.plateUnits) {
        return {
          available: false,
          message: `Insufficient plates available. Required: ${normalized.plateUnits}, Available: ${phoneModel.aluminumSheetsCount}`,
        };
      }
      
      return { available: true };
      
    } else if (itemCollectionType === 'other') {
      // Check Product inventory
      const product = await Product.findById(productId);
      
      if (!product) {
        return { 
          available: false, 
          message: 'Product not found' 
        };
      }
      
      const phoneBrand = product.phoneBrands?.find(pb => pb.brandName === selectedBrand);
      
      if (!phoneBrand) {
        return { 
          available: false, 
          message: `Brand "${selectedBrand}" not available for this product` 
        };
      }
      
      const phoneModel = phoneBrand.models?.find(m => m.modelName === selectedModel);
      
      if (!phoneModel) {
        return { 
          available: false, 
          message: `Model "${selectedModel}" not available for brand "${selectedBrand}"` 
        };
      }
      
      const requiredCovers = quantity || 1;
      
      if (phoneModel.coverCount < requiredCovers) {
        return { 
          available: false, 
          message: `Insufficient covers available. Required: ${requiredCovers}, Available: ${phoneModel.coverCount}` 
        };
      }
      
      return { available: true };
    }
    
    return { available: true }; // No inventory check needed for other types
    
  } catch (error) {
    console.error('Error checking inventory:', error);
    return { 
      available: false, 
      message: 'Error checking inventory availability' 
    };
  }
};

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
          productDetails = await Collection.findById(item.productId).select('name heroImage type plateprice').lean();
          if (!productDetails) {
            console.warn(`⚠️ Collection not found for ID: ${item.productId}`);
          } else {
            // Map heroImage to image for consistent frontend handling
            productDetails.image = productDetails.heroImage;
          }
          // Clean up: collections shouldn't have customDesign
          delete itemObj.customDesign;
        } else if (item.type === 'suggested') {
          productDetails = await SuggestedProduct.findById(item.productId).select('name image price description').lean();
          if (!productDetails) {
            console.warn(`⚠️ Suggested product not found for ID: ${item.productId}`);
          }
          // Clean up: suggested products shouldn't have customDesign
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

  // Calculate total (including plate prices for gaming collections)
  const total = populatedItems.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const plateTotal = (item.plateQuantity || 0) * (item.platePrice || 0);
    return sum + itemTotal + plateTotal;
  }, 0);

  // Debug logging
  console.log('📦 Cart items with product details:', JSON.stringify(populatedItems.map(item => ({
    type: item.type,
    productId:
    item.type === "custom-design"
        ? item.customDesignId
        : item.productId,
    quantity: item.quantity,
    plateQuantity: item.plateQuantity,
    platePrice: item.platePrice,
    productOption: item.productOption,
    collectionType: item.collectionType,
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
  
  const { 
    type, 
    productId,
    productRef,
    quantity = 1, 
    selectedBrand, 
    selectedModel, 
    price, 
    customDesign, 
    plateQuantity, 
    platePrice,
    productOption,
    collectionType,
    // Add image fields
    image,
    productImage,
    productName,
    collectionName
  } = req.body;

  const normalized = normalizeItemByOption({ quantity, plateQuantity, productOption, price });
  
  console.log('🛒 Adding item to cart:', { 
    type, 
    productId, 
    quantity, 
    selectedBrand, 
    selectedModel, 
    plateQuantity, 
    platePrice,
    productOption,
    collectionType,
    hasImage: !!image,
    hasProductImage: !!productImage,
    productName,
    collectionName
  });
  console.log('📊 PlateQuantity type:', typeof plateQuantity, 'Value:', plateQuantity);
  console.log('📊 PlatePrice type:', typeof platePrice, 'Value:', platePrice);
  console.log('📊 ProductOption:', productOption);
  console.log('📊 CollectionType:', collectionType);
  console.log('📊 Quantity (backcovers):', quantity);
  console.log('📊 Price:', price, 'Type:', typeof price);

  if (!productId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Product ID is required' 
    });
  }

  if (price === undefined || price === null) {
    return res.status(400).json({ 
      success: false, 
      message: 'Price is required' 
    });
  }

  if (!type || !['product', 'collection', 'custom-design', 'suggested'].includes(type)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Type must be "product", "collection", "custom-design", or "suggested"' 
    });
  }

  // Validate custom-design specific requirements
  if (type === 'custom-design' && !customDesign?.designImageUrl) {
    return res.status(400).json({ 
      success: false, 
      message: 'Custom design must include designImageUrl' 
    });
  }

  // Check inventory availability before adding to cart
  const inventoryCheck = await checkInventoryAvailability({
    type,
    productId,
    selectedBrand,
    selectedModel,
    quantity: normalized.storedQuantity,
    plateQuantity: normalized.storedPlateQuantity,
    productOption: normalized.option,
    collectionType
  });
  
  if (!inventoryCheck.available) {
    console.log(`❌ Inventory check failed: ${inventoryCheck.message}`);
    return res.status(400).json({
      success: false,
      message: inventoryCheck.message
    });
  }
  
  console.log('✅ Inventory check passed');

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }

  // Keep options separate so plate-only and combo rows do not corrupt each other.
  const existingItemIndex = cart.items.findIndex(
    item => 
      (
    type === "custom-design"
        ? item.customDesignId === productId
        : item.productId?.toString() === productId.toString()
) && 
      item.selectedBrand === selectedBrand && 
      item.selectedModel === selectedModel &&
      item.productOption === normalized.option
  );

  if (existingItemIndex > -1) {
    const existingItem = cart.items[existingItemIndex];
    console.log('📦 Found existing cart item:', {
      oldQuantity: existingItem.quantity,
      oldPlateQuantity: existingItem.plateQuantity,
      oldProductOption: existingItem.productOption
    });
    
    const addingCovers = normalized.option === 'plates-only' ? 0 : normalized.storedQuantity;
    const addingPlates = normalized.storedPlateQuantity;
    
    console.log('➕ Adding:', {
      covers: addingCovers,
      plates: addingPlates,
      newProductOption: productOption
    });
    
    if (normalized.option === 'plates-only') {
      existingItem.quantity = 1;
      existingItem.price = 0;
      existingItem.plateQuantity = (existingItem.plateQuantity || 0) + addingPlates;
    } else {
      existingItem.quantity += addingCovers;
      if (addingPlates > 0) {
        existingItem.plateQuantity = (existingItem.plateQuantity || 0) + addingPlates;
      }
      existingItem.price = normalized.storedPrice;
    }
    
    // Update image and name data if provided
    if (image) existingItem.image = image;
    if (productImage) existingItem.productImage = productImage;
    if (productName) existingItem.productName = productName;
    if (collectionName) existingItem.collectionName = collectionName;
    
    // Update plate price if provided
    if (platePrice !== undefined) {
      existingItem.platePrice = platePrice;
    }
    
    existingItem.productOption = normalized.option;
    
    console.log('✅ Updated cart item:', {
      newQuantity: existingItem.quantity,
      newPlateQuantity: existingItem.plateQuantity,
      newProductOption: existingItem.productOption
    });
  } else {
    // Add new item with appropriate structure based on type
    console.log('🆕 Creating new cart item');
    

    const newItem = {
    type,
    productRef:
        type === "collection"
            ? "Collection"
            : type === "product"
            ? "Product"
            : type === "suggested"
            ? "SuggestedProduct"
            : undefined,

    quantity: normalized.storedQuantity,
    selectedBrand: selectedBrand || "",
    selectedModel: selectedModel || "",
    price: normalized.storedPrice,
    productOption: normalized.option,
    collectionType: collectionType || "none",
};

if (type === "custom-design") {
    newItem.customDesignId = productId;
} else {
    newItem.productId = productId;
}
    
    // Add image data if provided
    if (image) newItem.image = image;
    if (productImage) newItem.productImage = productImage;
    if (productName) newItem.productName = productName;
    if (collectionName) newItem.collectionName = collectionName;
    
    // Add plate info for gaming collections
    if (normalized.storedPlateQuantity > 0) {
      newItem.plateQuantity = normalized.storedPlateQuantity;
    }
    if (platePrice !== undefined) {
      newItem.platePrice = platePrice;
    }
    
    console.log('📝 New cart item:', {
      quantity: newItem.quantity,
      plateQuantity: newItem.plateQuantity,
      platePrice: newItem.platePrice,
      productOption: newItem.productOption
    });
    
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
  
  // Log the saved cart item details for gaming collections
  if (type === 'collection') {
    const savedItem = cart.items[cart.items.length - 1];
    console.log('✅ Cart saved. Item details:', {
      type: savedItem.type,
      quantity: savedItem.quantity,
      plateQuantity: savedItem.plateQuantity,
      platePrice: savedItem.platePrice
    });
  }

  // Calculate total (including plate prices for gaming collections)
  const total = cart.items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const plateTotal = (item.plateQuantity || 0) * (item.platePrice || 0);
    return sum + itemTotal + plateTotal;
  }, 0);

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
  const { quantity, plateQuantity } = req.body;

  console.log('🔄 Updating cart item:', {
    productId,
    newQuantity: quantity,
    newPlateQuantity: plateQuantity
  });

  if (quantity === undefined && plateQuantity === undefined) {
    return res.status(400).json({ 
      success: false, 
      message: 'Quantity or plate quantity is required' 
    });
  }

  const cart = await Cart.findOne({ userId });
  if (!cart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });
  }

  console.log('🔍 Searching for item. ProductId from request:', productId);
  console.log('🔍 Cart items:', cart.items.map(i => ({
    productId: i.productId.toString(),
    type: i.type,
    quantity: i.quantity
  })));
  
  const item = cart.items.find(i =>
    req.body.type === "custom-design"
        ? i.customDesignId === productId
        : i.productId?.toString() === productId.toString()
);
  if (!item) {
    console.error('❌ Item not found! Requested:', productId);
    console.error('❌ Available items:', cart.items.map(i => i.productId.toString()));
    return res.status(404).json({ 
      success: false, 
      message: `Item not found in cart. ProductId: ${productId}` 
    });
  }
  
  console.log('✅ Found item:', {
    productId: item.productId.toString(),
    type: item.type,
    currentQuantity: item.quantity
  });

  console.log('📊 Current item state:', {
    oldQuantity: item.quantity,
    oldPlateQuantity: item.plateQuantity,
    collectionType: item.collectionType
  });

  if (item.productOption !== 'plates-only' && (!quantity || quantity < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Valid quantity is required (min: 1)',
    });
  }

  if (item.productOption === 'plates-only') {
    const normalizedPlateQty = plateQuantity !== undefined
      ? toNonNegativeInt(plateQuantity, 0)
      : Math.max(1, toNonNegativeInt(quantity, 1));
    if (normalizedPlateQty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid plate quantity is required (min: 1)',
      });
    }
    item.quantity = 1;
    item.price = 0;
    item.plateQuantity = normalizedPlateQty;
  } else {
    item.quantity = quantity;
    if (plateQuantity !== undefined) {
      item.plateQuantity = toNonNegativeInt(plateQuantity, 0);
    }
  }
  
  console.log('✅ Updated item state:', {
    newQuantity: item.quantity,
    newPlateQuantity: item.plateQuantity
  });

  await cart.save();

  // Calculate total (including plate prices for gaming collections)
  const total = cart.items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const plateTotal = (item.plateQuantity || 0) * (item.platePrice || 0);
    return sum + itemTotal + plateTotal;
  }, 0);

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

  const pullQuery =
    req.query.type === "custom-design"
        ? { customDesignId: productId }
        : { productId };

const cart = await Cart.findOneAndUpdate(
    { userId },
    {
        $pull: {
            items: pullQuery
        }
    },
    { new: true }
);

  if (!cart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });
  }

  // Calculate total (including plate prices for gaming collections)
  const total = cart.items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const plateTotal = (item.plateQuantity || 0) * (item.platePrice || 0);
    return sum + itemTotal + plateTotal;
  }, 0);

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
