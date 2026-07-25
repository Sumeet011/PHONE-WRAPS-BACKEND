const Product = require('./Product.model');
const PhoneBrand = require('../PhoneBrand/PhoneBrand.model'); // Import PhoneBrand model for global updates
const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @throws {Error} If ID is invalid
 */
const validateObjectId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid product ID format');
    }
};

/**
 * Sanitize and validate product data for creation/update
 * @param {Object} productData - Product data to validate
 * @param {boolean} isUpdate - If true, allows partial data
 * @throws {Error} If validation fails
 */
const validateProductData = (productData, isUpdate = false) => {
    if (!productData || typeof productData !== 'object') {
        throw new Error('Product data is required and must be an object');
    }

    // Validate required fields for creation
    if (!isUpdate) {
        if (!productData.name || typeof productData.name !== 'string') {
            throw new Error('Product name is required and must be a string');
        }
        if (!productData.type) {
            throw new Error('Product type is required');
        }
        if (!productData.category) {
            throw new Error('Category is required');
        }
        if (!productData.material) {
            throw new Error('Material is required');
        }
        if (!productData.design || !productData.design.type) {
            throw new Error('Design type is required');
        }
        if (!productData.design.color || !productData.design.color.primary) {
            throw new Error('Primary color is required');
        }
        if (!Array.isArray(productData.images) || productData.images.length === 0) {
            throw new Error('At least one image URL is required');
        }
        // Quantity is only required for 'other' type
        if (productData.type === 'other' && (productData.quantity === undefined || typeof productData.quantity !== 'number' || productData.quantity < 0)) {
            throw new Error('Quantity is required and must be a non-negative number for other type products');
        }

    }

    // Conditional validations
    if (productData.type === 'gaming' && (!productData.level || typeof productData.level !== 'string')) {
        throw new Error('Level is required for gaming products');
    }
    // Phone brands required for 'other' type via pre-save hook in model
    // No strictvalidation for coverprice or plateprice as they're optional in the model

    // Validate phoneBrands if provided (optional)
    if (productData.phoneBrands && Array.isArray(productData.phoneBrands)) {
        productData.phoneBrands.forEach((brand, brandIndex) => {
            if (!brand.brandName || typeof brand.brandName !== 'string' || !brand.brandName.trim()) {
                throw new Error(`Brand name at index ${brandIndex} is required and must be a non-empty string`);
            }
            if (!Array.isArray(brand.models) || brand.models.length === 0) {
                throw new Error(`At least one model is required for brand at index ${brandIndex}`);
            }
            brand.models.forEach((model, modelIndex) => {
                if (!model.modelName || typeof model.modelName !== 'string' || !model.modelName.trim()) {
                    throw new Error(`Model name at brand ${brandIndex}, model ${modelIndex} is required and must be a non-empty string`);
                }
                if (model.coverCount === undefined || typeof model.coverCount !== 'number' || model.coverCount < 0) {
                    throw new Error(`Cover count at brand ${brandIndex}, model ${modelIndex} must be a non-negative number`);
                }
            });
        });
    }

    // Validate arrays and nested objects
    if (productData.images && Array.isArray(productData.images)) {
        productData.images.forEach((url, index) => {
            if (typeof url !== 'string' || !url.trim()) {
                throw new Error(`Image URL at index ${index} must be a non-empty string`);
            }
            // Additional URL validation can be added here if needed
        });
    }


    // Validate price if provided
    if (productData.price !== undefined) {
        if (typeof productData.price !== 'number' || productData.price < 0) {
            throw new Error('Price must be a non-negative number');
        }
    }

    // Validate quantity if provided
    if (productData.quantity !== undefined) {
        if (typeof productData.quantity !== 'number' || productData.quantity < 0) {
            throw new Error('Quantity must be a non-negative number');
        }
    }

    // Trim strings to prevent whitespace issues
    if (productData.name) productData.name = productData.name.trim();
    if (productData.type) productData.type = productData.type.trim();
    if (productData.level) productData.level = productData.level.trim();
    if (productData.description) productData.description = productData.description.trim();
    if (productData.design && productData.design.color) {
        if (productData.design.color.primary) productData.design.color.primary = productData.design.color.primary.trim();
        if (productData.design.color.secondary) productData.design.color.secondary = productData.design.color.secondary.trim();
    }
    if (productData.design && productData.design.pattern) productData.design.pattern = productData.design.pattern.trim();
    // Trim features strings
    if (productData.features && Array.isArray(productData.features)) {
        productData.features = productData.features.map(f => f.trim()).filter(f => f);
    }
    // Trim phoneBrands strings
    if (productData.phoneBrands && Array.isArray(productData.phoneBrands)) {
        productData.phoneBrands.forEach(brand => {
            if (brand.brandName) brand.brandName = brand.brandName.trim();
            if (brand.models && Array.isArray(brand.models)) {
                brand.models.forEach(model => {
                    if (model.modelName) model.modelName = model.modelName.trim();
                });
            }
        });
    }
};

/**
 * Add phoneBrands to global PhoneBrand collection if provided
 * @param {Array} phoneBrands - Array of phone brands from product
 */
const addToGlobalPhoneBrands = async (phoneBrands) => {
    if (!phoneBrands || !Array.isArray(phoneBrands)) return;

    for (const brandData of phoneBrands) {
        try {
            let brand = await PhoneBrand.findOne({ brandName: brandData.brandName });

            if (!brand) {
                // Create new brand
                brand = new PhoneBrand({
                    brandName: brandData.brandName,
                    models: [],
                    isActive: true
                });
            }

            // Add models if not exist
            for (const modelData of brandData.models) {
                const existingModel = brand.models.find(m => m.modelName === modelData.modelName);
                if (!existingModel) {
                    brand.models.push({
                        modelName: modelData.modelName,
                        backCoversCount: 0,
                        aluminumSheetsCount: 0
                    });
                }
            }

            await brand.save();
        } catch (error) {
            console.error(`Error adding to global PhoneBrand: ${error.message}`);
            // Continue without failing the product creation
        }
    }
};

/**
 * Create a new product
 * @param {Object} productData - Product data
 * @returns {Promise<Object>} Created product
 * @throws {Error} If validation fails or creation error
 */
const createProduct = async (productData) => {
    try {
        validateProductData(productData, false);

        const product = new Product(productData);
        await product.save(); // Triggers schema validations and pre-save hooks

        // If phoneBrands provided, add to global PhoneBrand
        if (productData.phoneBrands) {
            await addToGlobalPhoneBrands(productData.phoneBrands);
        }

        return product.toObject();
    } catch (error) {
        if (error.name === 'ValidationError') {
            throw new Error(`Validation failed: ${Object.values(error.errors).map(e => e.message).join(', ')}`);
        }
        throw new Error(`Failed to create product: ${error.message}`);
    }
};

/**
 * Remove a product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Deleted product
 * @throws {Error} If ID invalid or product not found
 */
const removeProduct = async (productId) => {
    try {
        validateObjectId(productId);

        const deleted = await Product.findByIdAndDelete(productId);

        if (!deleted) {
            throw new Error('Product not found');
        }

        return deleted.toObject();
    } catch (error) {
        if (error.message === 'Product not found' || error.message === 'Invalid product ID format') {
            throw error;
        }
        throw new Error(`Failed to remove product: ${error.message}`);
    }
};

/**
 * Update a product by ID
 * @param {string} productId - Product ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated product
 * @throws {Error} If validation fails or product not found
 */
const updateProduct = async (productId, updateData) => {
    try {
        validateObjectId(productId);
        validateProductData(updateData, true);

        const updated = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { new: true, runValidators: true, context: 'query' }
        );

        if (!updated) {
            throw new Error('Product not found');
        }

        // If phoneBrands updated, add to global
        if (updateData.phoneBrands) {
            await addToGlobalPhoneBrands(updateData.phoneBrands);
        }

        return updated.toObject();
    } catch (error) {
        if (error.name === 'ValidationError') {
            throw new Error(`Validation failed: ${Object.values(error.errors).map(e => e.message).join(', ')}`);
        }
        if (error.message === 'Product not found' || error.message === 'Invalid product ID format') {
            throw error;
        }
        throw new Error(`Failed to update product: ${error.message}`);
    }
};

/**
 * Get a product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Product document with collection info
 * @throws {Error} If ID invalid or product not found
 */
const getProductById = async (productId) => {
    try {
        validateObjectId(productId);

        const product = await Product.findById(productId).lean();

        if (!product) {
            throw new Error('Product not found');
        }

        // Also fetch collections that contain this product
        const Collection = require('../Collection/Collection.model');
        const collections = await Collection.find({ products: productId })
            .select('_id name type price')
            .lean();
        
        // Add collections info to product
        product.collections = collections;

        return product;
    } catch (error) {
        if (error.message === 'Product not found' || error.message === 'Invalid product ID format') {
            throw error;
        }
        throw new Error(`Failed to fetch product: ${error.message}`);
    }
};

/**
 * Get products with optional filter and pagination
 * @param {Object} filter - MongoDB filter object
 * @param {Object} options - Pagination and sort options
 * @returns {Promise<Object>} Paginated results
 * @throws {Error} If options are invalid
 */
const getProductsByFilter = async (filter = {}, options = {}) => {
    try {
        const limit = Math.min(parseInt(options.limit) || 20, 100); // Cap at 100 for safety
        const page = Math.max(parseInt(options.page) || 1, 1);
        const skip = (page - 1) * limit;

        // Sanitize sort option
        const sortOption = options.sort || '-createdAt';
        if (typeof sortOption !== 'string' || !/^[a-zA-Z_.-]+$/.test(sortOption.replace(/^-/, ''))) {
            throw new Error('Invalid sort option');
        }

        const products = await Product.find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean for better performance

        const total = await Product.countDocuments(filter);

        return {
            items: products,
            total,
            page,
            pages: Math.ceil(total / limit),
        };
    } catch (error) {
        throw new Error(`Failed to fetch products: ${error.message}`);
    }
};

/**
 * Search products by name or description
 * @param {string} searchTerm - Search term
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Search results
 */
const searchProducts = async (searchTerm, options = {}) => {
    try {
        if (!searchTerm || typeof searchTerm !== 'string') {
            throw new Error('Search term is required and must be a string');
        }

        const sanitizedTerm = searchTerm.trim();
        if (sanitizedTerm.length === 0) {
            return getProductsByFilter({}, options);
        }

        const filter = {
            $or: [
                { name: { $regex: sanitizedTerm, $options: 'i' } },
                { description: { $regex: sanitizedTerm, $options: 'i' } }
            ]
        };

        return await getProductsByFilter(filter, options);
    } catch (error) {
        throw new Error(`Failed to search products: ${error.message}`);
    }
};

module.exports = {
    createProduct,
    removeProduct,
    updateProduct,
    getProductById,
    getProductsByFilter,
    searchProducts
};
