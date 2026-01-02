const {
  createProduct,
  removeProduct,
  updateProduct,
  getProductById,
  getProductsByFilter,
} = require('../../Models/Products/Product.service');
const { addProductToCollection } = require('../../Models/Collection/Collection.service');
const { addCollectionToGroup } = require('../../Models/Group/Group.service');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  try {
    // Extract data from request body
    const {
      name,
      description,
      price,
      type,
      level,
      category,
      material,
      finish,
      designType,
      primaryColor,
      secondaryColor,
      hexCode,
      pattern,
      customizable,
      features,
      collectionId,
      groupId
    } = req.body;

    // Removed excessive debug logging for production

    // Check if image was uploaded
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Product image is required" });
    }

    // Build product data object
    const productData = {
      name,
      description,
      price: Number(price),
      type,
      level,
      category,
      material,
      finish,
      image: req.file.path, // Cloudinary URL
      design: {
        type: designType,
        color: {
          primary: primaryColor,
          secondary: secondaryColor || undefined,
          hexCode: hexCode || undefined
        },
        pattern: pattern || undefined,
        customizable: customizable === 'true' || customizable === true
      },
      Features: features ? features.split(',').map(f => f.trim()).filter(f => f) : []
    };

    // Create the product
    const product = await createProduct(productData);

    // If gaming product, add to collection and optionally to group
    if (type === 'gaming') {
      if (!collectionId) {
        return res.status(400).json({ success: false, message: "Collection is required for gaming products" });
      }
      if (!groupId) {
        return res.status(400).json({ success: false, message: "Group is required for gaming products" });
      }

      // Add product to collection
      await addProductToCollection(collectionId, product._id);

      // Add collection to group (if not already added)
      await addCollectionToGroup(groupId, collectionId);
    }
    // If Standard product, add to collection (no group required)
    else if (type === 'Standard') {
      if (!collectionId) {
        return res.status(400).json({ success: false, message: "Collection is required for standard products" });
      }

      // Add product to collection
      await addProductToCollection(collectionId, product._id);
    }

    res.status(201).json({ 
      success: true, 
      message: "Product added successfully",
      data: product 
    });
  } catch (error) {
    // Error is already handled by asyncHandler wrapper
    throw error;
  }
});

exports.update = asyncHandler(async (req, res) => {
  const doc = await updateProduct(req.params.id, req.body);
  res.status(200).json({ success: true, data: doc });
});

exports.remove = asyncHandler(async (req, res) => {
  await removeProduct(req.params.id);
  res.status(204).send();
});

exports.getById = asyncHandler(async (req, res) => {
  const doc = await getProductById(req.params.id);
  res.status(200).json({ success: true, data: doc });
});

exports.list = asyncHandler(async (req, res) => {
  const { limit, page, sort, ...filters } = req.query;
  const result = await getProductsByFilter(filters, { limit, page, sort });
  res.status(200).json({ success: true, ...result });
});
