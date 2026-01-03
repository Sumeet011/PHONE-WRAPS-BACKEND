const SuggestedProduct = require('./SuggestedProduct.model');

// Create a new suggested product
const createSuggestedProduct = async (data) => {
  if (!data) throw new Error("Suggested product data is required");
  
  const suggestedProduct = await SuggestedProduct.create(data);
  return suggestedProduct;
};

// Get all suggested products
const getAllSuggestedProducts = async (filter = {}) => {
  const suggestedProducts = await SuggestedProduct.find(filter).sort({ displayOrder: 1, createdAt: -1 });
  return suggestedProducts;
};

// Get suggested product by ID
const getSuggestedProductById = async (id) => {
  if (!id) throw new Error("Suggested product ID is required");
  
  const suggestedProduct = await SuggestedProduct.findById(id);
  if (!suggestedProduct) throw new Error("Suggested product not found");
  
  return suggestedProduct;
};

// Update suggested product
const updateSuggestedProduct = async (id, updateData) => {
  if (!id || !updateData) throw new Error("ID and update data are required");
  
  const updated = await SuggestedProduct.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  );
  
  if (!updated) throw new Error("Suggested product not found");
  
  return updated;
};

// Delete suggested product
const deleteSuggestedProduct = async (id) => {
  if (!id) throw new Error("Suggested product ID is required");
  
  const deleted = await SuggestedProduct.findByIdAndDelete(id);
  if (!deleted) throw new Error("Suggested product not found");
  
  return deleted;
};

module.exports = {
  createSuggestedProduct,
  getAllSuggestedProducts,
  getSuggestedProductById,
  updateSuggestedProduct,
  deleteSuggestedProduct
};
