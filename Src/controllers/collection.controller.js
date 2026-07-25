const {
  createCollection,
  removeCollection,
  updateCollection,
  getCollectionById,
  getCollectionsByFilter,
  addProductToCollection,
  removeProductFromCollection,
} = require('../../Models/Collection/Collection.service');

const { addCollectionToGroup } = require('../../Models/Group/Group.service');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  // Add hero image URL if uploaded
  if (req.file && req.file.path) {
    req.body.heroImage = req.file.path;
  }
  
  // Parse price fields - only for gaming and swap-wrap types
  if ((req.body.type === 'gaming' || req.body.type === 'swap-wrap')) {
    // Keep price and plateprice as flat fields
    if (req.body.price) {
      req.body.price = parseFloat(req.body.price) || 0;
    }
    if (req.body.plateprice) {
      req.body.plateprice = parseFloat(req.body.plateprice) || 0;
    }
  } else {
    // For 'normal' type, remove price fields if present
    delete req.body.price;
    delete req.body.plateprice;
  }
  
  // Handle features array
  if (req.body['features[]']) {
    req.body.features = Array.isArray(req.body['features[]']) 
      ? req.body['features[]'] 
      : [req.body['features[]']];
    delete req.body['features[]'];
  }
  
  // Extract groupId before creating collection
  const groupId = req.body.groupId;
  delete req.body.groupId;
  
  const doc = await createCollection(req.body);
  
  // If groupId provided, add collection to group
  if (groupId && doc.type === 'gaming') {
    await addCollectionToGroup(groupId, doc._id);
  }
  
  res.status(201).json({ success: true, data: doc });
});

exports.update = asyncHandler(async (req, res) => {
  // Add hero image URL if uploaded
  if (req.file && req.file.path) {
    req.body.heroImage = req.file.path;
  }
  
  // Parse price fields - only for gaming and swap-wrap types
  if ((req.body.type === 'gaming' || req.body.type === 'swap-wrap')) {
    // Keep price and plateprice as flat fields
    if (req.body.price) {
      req.body.price = parseFloat(req.body.price) || 0;
    }
    if (req.body.plateprice) {
      req.body.plateprice = parseFloat(req.body.plateprice) || 0;
    }
  } else if (req.body.type === 'normal') {
    // For 'normal' type, remove price fields if present
    delete req.body.price;
    delete req.body.plateprice;
  }
  
  // Handle features array
  if (req.body['features[]']) {
    req.body.features = Array.isArray(req.body['features[]']) 
      ? req.body['features[]'] 
      : [req.body['features[]']];
    delete req.body['features[]'];
  }
  
  const doc = await updateCollection(req.params.id, req.body);
  res.status(200).json({ success: true, data: doc });
});

exports.remove = asyncHandler(async (req, res) => {
  await removeCollection(req.params.id);
  res.status(200).json({ success: true, message: 'Collection deleted successfully' });
});

exports.getById = asyncHandler(async (req, res) => {
  const doc = await getCollectionById(req.params.id);
  res.status(200).json({ success: true, data: doc });
});

exports.list = asyncHandler(async (req, res) => {
  const { limit, page, sort, ...filters } = req.query;
  const result = await getCollectionsByFilter(filters, { limit, page, sort });
  res.status(200).json({ success: true, ...result });
});

exports.addProduct = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const collection = await addProductToCollection(req.params.id, productId);
  res.status(200).json({ success: true, data: collection });
});

exports.removeProduct = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const collection = await removeProductFromCollection(req.params.id, productId);
  res.status(200).json({ success: true, data: collection });
});
