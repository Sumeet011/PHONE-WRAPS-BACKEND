const Product = require("./Product.model");

// Create a product
const createProduct = async (productData) => {
  if (!productData) throw new Error("Product data is required");
  
  const product = await Product.create(productData);
  return product;
};

// Remove a product by _id
const removeProduct = async (productId) => {
  if (!productId) throw new Error("Product id is required");

  const deleted = await Product.findByIdAndDelete(productId);
  if (!deleted) throw new Error("Product not found");

  return deleted;
};

// Update a product
const updateProduct = async (productId, updateData) => {
  if (!productId || !updateData) throw new Error("Product id and update data are required");

  const updated = await Product.findByIdAndUpdate(
    productId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updated) throw new Error("Product not found");

  return updated;
};

// Get a product by _id
const getProductById = async (productId) => {
  if (!productId) throw new Error("Product id is required");

  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  return product;
};

// Get products with optional filter and pagination
const getProductsByFilter = async (filter = {}, options = {}) => {
  const limit = options.limit || 20;
  const page = options.page || 1;
  const skip = (page - 1) * limit;

  const products = await Product.find(filter)
    .sort(options.sort || "-createdAt")
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(filter);

  return {
    items: products,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

module.exports = {
  createProduct,
  removeProduct,
  updateProduct,
  getProductById,
  getProductsByFilter,
};
