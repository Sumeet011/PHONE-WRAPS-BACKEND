const {
  createCollection,
  removeCollection,
  updateCollection,
  getCollectionById,
  getCollectionsByFilter,
  addProductToCollection,
  removeProductFromCollection,
} = require('../../Models/Collection/Collection.service');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  const doc = await createCollection(req.body);
  res.status(201).json({ success: true, data: doc });
});

exports.update = asyncHandler(async (req, res) => {
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
