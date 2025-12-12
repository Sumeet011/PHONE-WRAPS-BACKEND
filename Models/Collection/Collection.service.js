const Collection = require('./Collection.model');

const createCollection = async (data) => {
  if (!data) throw new Error("Collection data is required");
  
  const collection = await Collection.create(data);
  return collection;
};

const removeCollection = async (collectionId) => {
  if (!collectionId) throw new Error("Collection id is required");

  const deleted = await Collection.findByIdAndDelete(collectionId);
  if (!deleted) throw new Error("Collection not found");

  return deleted;
};

const updateCollection = async (collectionId, updateData) => {
  if (!collectionId || !updateData) throw new Error("Collection id and update data are required");

  const updated = await Collection.findByIdAndUpdate(
    collectionId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
  
  if (!updated) throw new Error("Collection not found");
  
  return updated;
};

const getCollectionById = async (collectionId) => {
  if (!collectionId) throw new Error("Collection id is required");

  const collection = await Collection.findById(collectionId)
    .populate('Products')
    .populate('reviews.userId', 'username email');
  
  if (!collection) throw new Error("Collection not found");

  return collection;
};

const getCollectionsByFilter = async (filter = {}, options = {}) => {
  const limit = options.limit || 20;
  const page = options.page || 1;
  const skip = (page - 1) * limit;

  const [collections, total] = await Promise.all([
    Collection.find(filter)
      .populate('Products')
      .sort(options.sort || '-createdAt')
      .skip(skip)
      .limit(limit),
    Collection.countDocuments(filter)
  ]);

  return {
    items: collections,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

// Add product to collection
const addProductToCollection = async (collectionId, productId) => {
  console.log('[addProductToCollection] Called with collectionId:', collectionId, 'productId:', productId);
  
  if (!collectionId || !productId) {
    console.log('[addProductToCollection] ERROR: Missing required parameters');
    throw new Error("Collection id and product id are required");
  }

  const collection = await Collection.findById(collectionId);
  console.log('[addProductToCollection] Collection found:', collection ? collection.name : 'NOT FOUND');
  
  if (!collection) {
    console.log('[addProductToCollection] ERROR: Collection not found');
    throw new Error("Collection not found");
  }

  // Avoid duplicates
  if (!collection.Products.includes(productId)) {
    console.log('[addProductToCollection] Adding product to collection...');
    collection.Products.push(productId);
    await collection.save();
    console.log('[addProductToCollection] Product added successfully. Total products:', collection.Products.length);
  } else {
    console.log('[addProductToCollection] Product already exists in collection');
  }

  return collection;
};

// Remove product from collection
const removeProductFromCollection = async (collectionId, productId) => {
  if (!collectionId || !productId) throw new Error("Collection id and product id are required");

  const collection = await Collection.findByIdAndUpdate(
    collectionId,
    { $pull: { Products: productId } },
    { new: true }
  );

  if (!collection) throw new Error("Collection not found");

  return collection;
};

module.exports = {
  createCollection,
  removeCollection,
  updateCollection,
  getCollectionById,
  getCollectionsByFilter,
  addProductToCollection,
  removeProductFromCollection,
};
