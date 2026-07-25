const Collection = require('./Collection.model');
const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @throws {Error} If ID is invalid
 */
const validateObjectId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid ID format');
    }
};

/**
 * Sanitize and validate collection data for creation/update
 * @param {Object} collectionData - Collection data to validate
 * @param {boolean} isUpdate - If true, allows partial data
 * @throws {Error} If validation fails
 */
const validateCollectionData = (collectionData, isUpdate = false) => {
    if (!collectionData || typeof collectionData !== 'object') {
        throw new Error('Collection data is required and must be an object');
    }

    // Validate required fields for creation
    if (!isUpdate) {
        if (!collectionData.name || typeof collectionData.name !== 'string') {
            throw new Error('Collection name is required and must be a string');
        }
        if (!collectionData.type) {
            throw new Error('Collection type is required');
        }
    }

    // Conditional price validation: Required for 'gaming' or 'swap-wrap' types
    if (collectionData.type === 'gaming' || collectionData.type === 'swap-wrap') {
        // Validate flat price structure (after migration)
        if (!isUpdate || collectionData.price !== undefined) {
            if (collectionData.price !== undefined && (typeof collectionData.price !== 'number' || collectionData.price < 0)) {
                throw new Error('Price must be a non-negative number for gaming or swap-wrap collections');
            }
        }
        if (collectionData.plateprice !== undefined && (typeof collectionData.plateprice !== 'number' || collectionData.plateprice < 0)) {
            throw new Error('Plate price must be a non-negative number');
        }
    }

    // Validate arrays and nested objects
    if (collectionData.products && Array.isArray(collectionData.products)) {
        collectionData.products.forEach((id, index) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error(`Invalid product ID at index ${index}`);
            }
        });
    }

    if (collectionData.features && Array.isArray(collectionData.features)) {
        collectionData.features.forEach((feature, index) => {
            if (typeof feature !== 'string' || !feature.trim()) {
                throw new Error(`Feature at index ${index} must be a non-empty string`);
            }
        });
        // Trim features
        collectionData.features = collectionData.features.map(f => f.trim()).filter(f => f);
    }

    // Trim strings to prevent whitespace issues
    if (collectionData.name) collectionData.name = collectionData.name.trim();
    if (collectionData.description) collectionData.description = collectionData.description.trim();
    if (collectionData.heroImage) collectionData.heroImage = collectionData.heroImage.trim();
};

/**
 * Create a new collection
 * @param {Object} data - Collection data
 * @returns {Promise<Object>} Created collection
 * @throws {Error} If validation fails or creation error
 */
const createCollection = async (data) => {
    try {
        validateCollectionData(data, false);

        const collection = await Collection.create(data);
        return collection.toObject();
    } catch (error) {
        if (error.name === 'ValidationError') {
            throw new Error(`Validation failed: ${Object.values(error.errors).map(e => e.message).join(', ')}`);
        }
        throw new Error(`Failed to create collection: ${error.message}`);
    }
};

/**
 * Remove a collection by ID
 * @param {string} collectionId - Collection ID
 * @returns {Promise<Object>} Deleted collection
 * @throws {Error} If ID invalid or collection not found
 */
const removeCollection = async (collectionId) => {
    try {
        validateObjectId(collectionId);

        const deleted = await Collection.findByIdAndDelete(collectionId);

        if (!deleted) {
            throw new Error('Collection not found');
        }

        return deleted.toObject();
    } catch (error) {
        if (error.message === 'Collection not found' || error.message === 'Invalid ID format') {
            throw error;
        }
        throw new Error(`Failed to remove collection: ${error.message}`);
    }
};

/**
 * Update a collection by ID
 * @param {string} collectionId - Collection ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated collection
 * @throws {Error} If validation fails or collection not found
 */
const updateCollection = async (collectionId, updateData) => {
    try {
        validateObjectId(collectionId);
        validateCollectionData(updateData, true);

        const updated = await Collection.findByIdAndUpdate(
            collectionId,
            { $set: updateData },
            { new: true, runValidators: true, context: 'query' }
        );

        if (!updated) {
            throw new Error('Collection not found');
        }

        return updated.toObject();
    } catch (error) {
        if (error.name === 'ValidationError') {
            throw new Error(`Validation failed: ${Object.values(error.errors).map(e => e.message).join(', ')}`);
        }
        if (error.message === 'Collection not found' || error.message === 'Invalid ID format') {
            throw error;
        }
        throw new Error(`Failed to update collection: ${error.message}`);
    }
};

/**
 * Get a collection by ID
 * @param {string} collectionId - Collection ID
 * @returns {Promise<Object>} Collection document
 * @throws {Error} If ID invalid or collection not found
 */
const getCollectionById = async (collectionId) => {
    try {
        validateObjectId(collectionId);

        const collection = await Collection.findById(collectionId)
            .populate('products') // Fixed: 'Products' -> 'products' (lowercase for schema consistency)
            .lean();

        if (!collection) {
            throw new Error('Collection not found');
        }

        return collection;
    } catch (error) {
        if (error.message === 'Collection not found' || error.message === 'Invalid ID format') {
            throw error;
        }
        throw new Error(`Failed to fetch collection: ${error.message}`);
    }
};

/**
 * Get collections with optional filter and pagination
 * @param {Object} filter - MongoDB filter object
 * @param {Object} options - Pagination and sort options
 * @returns {Promise<Object>} Paginated results
 * @throws {Error} If options are invalid
 */
const getCollectionsByFilter = async (filter = {}, options = {}) => {
    try {
        const limit = Math.min(parseInt(options.limit) || 20, 100); // Cap at 100 for safety
        const page = Math.max(parseInt(options.page) || 1, 1);
        const skip = (page - 1) * limit;

        // Sanitize sort option
        const sortOption = options.sort || '-createdAt';
        if (typeof sortOption !== 'string' || !/^[a-zA-Z_.-]+$/.test(sortOption.replace(/^-/, ''))) {
            throw new Error('Invalid sort option');
        }

        const [collections, total] = await Promise.all([
            Collection.find(filter)
                .populate('products') // Fixed: 'Products' -> 'products'
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
                .lean(), // Use lean for better performance
            Collection.countDocuments(filter)
        ]);

        return {
            items: collections,
            total,
            page,
            pages: Math.ceil(total / limit),
        };
    } catch (error) {
        throw new Error(`Failed to fetch collections: ${error.message}`);
    }
};

/**
 * Add product to collection
 * @param {string} collectionId - Collection ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Updated collection
 * @throws {Error} If validation fails or collection/product not found
 */
const addProductToCollection = async (collectionId, productId) => {
    try {
        validateObjectId(collectionId);
        validateObjectId(productId);

        // Use findByIdAndUpdate with $addToSet to avoid full document validation
        const collection = await Collection.findByIdAndUpdate(
            collectionId,
            { $addToSet: { products: productId } }, // $addToSet avoids duplicates automatically
            { new: true, runValidators: false } // Skip validators when just adding products
        );

        if (!collection) {
            throw new Error('Collection not found');
        }

        return collection.toObject();
    } catch (error) {
        if (error.message === 'Collection not found' || error.message === 'Invalid ID format') {
            throw error;
        }
        throw new Error(`Failed to add product to collection: ${error.message}`);
    }
};

/**
 * Remove product from collection
 * @param {string} collectionId - Collection ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Updated collection
 * @throws {Error} If validation fails or collection not found
 */
const removeProductFromCollection = async (collectionId, productId) => {
    try {
        validateObjectId(collectionId);
        validateObjectId(productId);

        const collection = await Collection.findByIdAndUpdate(
            collectionId,
            { $pull: { products: productId } }, // Fixed: 'Products' -> 'products'
            { new: true }
        );

        if (!collection) {
            throw new Error('Collection not found');
        }

        return collection.toObject();
    } catch (error) {
        if (error.message === 'Collection not found' || error.message === 'Invalid ID format') {
            throw error;
        }
        throw new Error(`Failed to remove product from collection: ${error.message}`);
    }
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
