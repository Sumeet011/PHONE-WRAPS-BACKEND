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

    console.log('Received product data:', req.body);
    console.log('Product type:', type);
    console.log('Product type comparison - gaming:', type === 'gaming');
    console.log('Product type comparison - Standard:', type === 'Standard');
    console.log('Collection ID:', collectionId);
    console.log('Group ID:', groupId);
    console.log('Received file:', req.file);

    // Check if image was uploaded
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Product image is required" });
    }

    // Build product data object
    const productData = {
      name,
      description,
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
    
    // Only add price for Standard products (gaming products get price from collection)
    if (type === 'Standard' && price) {
      productData.price = Number(price);
    }

    console.log('Product data to be saved:', JSON.stringify(productData, null, 2));

    // Create the product
    const product = await createProduct(productData);
    console.log('Product created with ID:', product._id);
    console.log('About to check product type conditions...');
    console.log('Type value:', type);
    console.log('Type typeof:', typeof type);

    // If gaming product, add to collection and optionally to group
    if (type === 'gaming') {
      console.log('Processing gaming product...');
      if (!collectionId) {
        return res.status(400).json({ success: false, message: "Collection is required for gaming products" });
      }
      if (!groupId) {
        return res.status(400).json({ success: false, message: "Group is required for gaming products" });
      }

      // Add product to collection
      console.log('Adding product to gaming collection:', collectionId);
      await addProductToCollection(collectionId, product._id);
      console.log('Product successfully added to gaming collection');

      // Add collection to group (if not already added)
      console.log('Adding collection to group:', groupId);
      await addCollectionToGroup(groupId, collectionId);
      console.log('Collection added to group successfully');
    }
    // If Standard product, add to collection (no group required)
    else if (type === 'Standard') {
      console.log('Processing Standard product...');
      console.log('Standard product collectionId:', collectionId);
      
      if (!collectionId) {
        console.log('ERROR: No collectionId provided for Standard product');
        return res.status(400).json({ success: false, message: "Collection is required for standard products" });
      }

      // Add product to collection
      console.log('Attempting to add product', product._id, 'to standard collection', collectionId);
      const result = await addProductToCollection(collectionId, product._id);
      console.log('addProductToCollection result:', result);
      console.log('Product successfully added to standard collection:', collectionId);
    } else {
      console.log('WARNING: Product type did not match gaming or Standard. Type was:', type);
    }

    res.status(201).json({ 
      success: true, 
      message: "Product added successfully",
      data: product 
    });
  } catch (error) {
    console.error('Error creating product:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to create product",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

exports.update = asyncHandler(async (req, res) => {
  try {
    const updateData = {};
    
    // Handle text fields from FormData
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description) updateData.description = req.body.description;
    if (req.body.price) updateData.price = Number(req.body.price);
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.material) updateData.material = req.body.material;
    if (req.body.finish) updateData.finish = req.body.finish;
    if (req.body.level) updateData.level = req.body.level;
    
    // Handle image upload
    if (req.file && req.file.path) {
      updateData.image = req.file.path;
    }
    
    // Handle design object
    if (req.body.designType || req.body.primaryColor || req.body.secondaryColor || 
        req.body.hexCode || req.body.pattern || req.body.customizable !== undefined) {
      updateData.design = {
        type: req.body.designType,
        color: {
          primary: req.body.primaryColor,
          secondary: req.body.secondaryColor,
          hexCode: req.body.hexCode
        },
        pattern: req.body.pattern,
        customizable: req.body.customizable === 'true' || req.body.customizable === true
      };
    }
    
    // Handle features array
    if (req.body.features) {
      updateData.Features = req.body.features.split(',').map(f => f.trim()).filter(f => f);
    }
    
    console.log('Update data prepared:', updateData);
    
    const doc = await updateProduct(req.params.id, updateData);
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to update product'
    });
  }
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
