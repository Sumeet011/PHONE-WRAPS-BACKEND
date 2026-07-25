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
      quantity,
      category,
      material,
      finish,
      designType,
      primaryColor,
      secondaryColor,
      hexCode,
      pattern,
      customizable,
      showInBrowseAll,
      features,
      collectionId,
      groupId,
      phoneBrands
    } = req.body;

    console.log('Received product data:', req.body);
    console.log('Product type:', type);
    console.log('Product type comparison - gaming:', type === 'gaming');
    console.log('Product type comparison - Standard:', type === 'Standard');
    console.log('Collection ID:', collectionId);
    console.log('Group ID:', groupId);
    console.log('Received files:', req.files);

    // Check if at least one image was uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: "At least one product image is required" });
    }

    // Collect all uploaded image URLs
    const imageUrls = [];
    if (req.files.image1) imageUrls.push(req.files.image1[0].path);
    if (req.files.image2) imageUrls.push(req.files.image2[0].path);
    if (req.files.image3) imageUrls.push(req.files.image3[0].path);
    if (req.files.image4) imageUrls.push(req.files.image4[0].path);

    // Build product data object
    const productData = {
      name,
      description,
      type,
      level,
      quantity: Number(quantity) || 0,
      category,
      material,
      finish,
      images: imageUrls, // Array of Cloudinary URLs
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
      showInBrowseAll: showInBrowseAll === 'true' || showInBrowseAll === true,
      features: features ? features.split(',').map(f => f.trim()).filter(f => f) : []
    };
    
    // Only add price for non-gaming products (gaming products get price from collection)
    if (type !== 'gaming' && price) {
      productData.coverprice = Number(price);
    }
    
    // Add plate price for swap-wrap products
    if (type === 'swap-wrap' && req.body.plateprice) {
      productData.plateprice = Number(req.body.plateprice);
    }
    
    // Add phone brands data for 'other' type products - MUST be done before product creation
    console.log('Checking phoneBrands - Type:', type, 'phoneBrands exists:', !!phoneBrands, 'phoneBrands value:', phoneBrands);
    if (type === 'other' && phoneBrands) {
      try {
        const parsedPhoneBrands = typeof phoneBrands === 'string' ? JSON.parse(phoneBrands) : phoneBrands;
        console.log('Parsed phone brands:', JSON.stringify(parsedPhoneBrands, null, 2));
        productData.phoneBrands = parsedPhoneBrands;
        console.log('Phone brands data added to productData');
      } catch (error) {
        console.error('Error parsing phoneBrands:', error);
        return res.status(400).json({ success: false, message: "Invalid phone brands data format" });
      }
    } else if (type === 'other') {
      console.log('WARNING: other type product but no phoneBrands data received');
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
    // If swap-wrap, normal, or other product, optionally add to collection
    else if (type === 'swap-wrap' || type === 'normal' || type === 'other') {
      console.log(`Processing ${type} product...`);
      console.log('Product collectionId:', collectionId);
      
      // Collection is optional for normal and other, required for swap-wrap
      if (collectionId) {
        console.log('Attempting to add product', product._id, 'to collection', collectionId);
        const result = await addProductToCollection(collectionId, product._id);
        console.log('addProductToCollection result:', result);
        console.log(`Product successfully added to collection: ${collectionId}`);
      } else if (type === 'swap-wrap') {
        return res.status(400).json({ success: false, message: "Collection is required for swap-wrap products" });
      }
    } else {
      console.log('WARNING: Product type did not match any known type. Type was:', type);
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
    const existingProduct = await getProductById(req.params.id);

    if (!existingProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Handle text fields from FormData
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description) updateData.description = req.body.description;
    if (req.body.price) updateData.coverprice = Number(req.body.price);
    if (req.body.plateprice) updateData.plateprice = Number(req.body.plateprice);
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.material) updateData.material = req.body.material;
    if (req.body.finish) updateData.finish = req.body.finish;
    if (req.body.level) updateData.level = req.body.level;
    if (req.body.showInBrowseAll !== undefined) {
      updateData.showInBrowseAll = req.body.showInBrowseAll === 'true' || req.body.showInBrowseAll === true;
    }
    
    // Handle phone brands for 'other' type products
    if (req.body.phoneBrands) {
      try {
        updateData.phoneBrands = typeof req.body.phoneBrands === 'string' 
          ? JSON.parse(req.body.phoneBrands) 
          : req.body.phoneBrands;
        console.log('Updated phone brands data:', updateData.phoneBrands);
      } catch (error) {
        console.error('Error parsing phoneBrands on update:', error);
      }
    }
    
    // Handle image uploads and merge by slot to preserve existing images.
    // image1 maps to index 0, image2->1, image3->2, image4->3
    const mergedImages = Array.isArray(existingProduct.images)
      ? [...existingProduct.images]
      : [];

    if (req.file && req.file.path) {
      mergedImages[0] = req.file.path;
    }

    if (req.files && Object.keys(req.files).length > 0) {
      if (req.files.image1) mergedImages[0] = req.files.image1[0].path;
      if (req.files.image2) mergedImages[1] = req.files.image2[0].path;
      if (req.files.image3) mergedImages[2] = req.files.image3[0].path;
      if (req.files.image4) mergedImages[3] = req.files.image4[0].path;
    }

    const normalizedImages = mergedImages.filter(Boolean);
    if (normalizedImages.length > 0) {
      updateData.images = normalizedImages;
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
      updateData.features = req.body.features.split(',').map(f => f.trim()).filter(f => f);
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
