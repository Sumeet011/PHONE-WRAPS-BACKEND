const FeaturedHomeProduct = require('./FeaturedHomeProduct.model');

// Create
exports.createFeaturedHomeProduct = async (data) => {
    const product = new FeaturedHomeProduct(data);
    return await product.save();
};

// Get all
exports.getAllFeaturedHomeProducts = async (filter = {}) => {
    return await FeaturedHomeProduct.find(filter).sort({ displayOrder: 1, createdAt: -1 });
};

// Get by ID
exports.getFeaturedHomeProductById = async (id) => {
    const product = await FeaturedHomeProduct.findById(id);
    if (!product) {
        throw new Error('Featured home product not found');
    }
    return product;
};

// Update
exports.updateFeaturedHomeProduct = async (id, updateData) => {
    const product = await FeaturedHomeProduct.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
    );
    if (!product) {
        throw new Error('Featured home product not found');
    }
    return product;
};

// Delete
exports.deleteFeaturedHomeProduct = async (id) => {
    const product = await FeaturedHomeProduct.findByIdAndDelete(id);
    if (!product) {
        throw new Error('Featured home product not found');
    }
    return product;
};

// Count active products
exports.countActiveFeaturedProducts = async () => {
    return await FeaturedHomeProduct.countDocuments({ isActive: true });
};
