const PhoneBrand = require('./PhoneBrand.model');
const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @throws {Error} If ID is invalid
 */
const validateObjectId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid brand ID format');
    }
};

/**
 * Sanitize and validate brand name
 * @param {string} brandName - The brand name to validate
 * @returns {string} Sanitized brand name
 * @throws {Error} If brand name is invalid
 */
const validateBrandName = (brandName) => {
    if (!brandName || typeof brandName !== 'string') {
        throw new Error('Brand name is required and must be a string');
    }
    
    const sanitized = brandName.trim();
    
    if (sanitized.length === 0) {
        throw new Error('Brand name cannot be empty');
    }
    
    if (sanitized.length > 100) {
        throw new Error('Brand name cannot exceed 100 characters');
    }
    
    return sanitized;
};

/**
 * Validate model data
 * @param {Object} modelData - The model data to validate
 * @throws {Error} If model data is invalid
 */
const validateModelData = (modelData) => {
    if (!modelData || typeof modelData !== 'object') {
        throw new Error('Model data is required');
    }
    
    if (!modelData.modelName || typeof modelData.modelName !== 'string') {
        throw new Error('Model name is required and must be a string');
    }
    
    const sanitizedName = modelData.modelName.trim();
    
    if (sanitizedName.length === 0) {
        throw new Error('Model name cannot be empty');
    }
    
    if (sanitizedName.length > 100) {
        throw new Error('Model name cannot exceed 100 characters');
    }
    
    // Validate counts if provided
    if (modelData.backCoversCount !== undefined) {
        if (typeof modelData.backCoversCount !== 'number' || modelData.backCoversCount < 0) {
            throw new Error('Back covers count must be a non-negative number');
        }
    }
    
    if (modelData.aluminumSheetsCount !== undefined) {
        if (typeof modelData.aluminumSheetsCount !== 'number' || modelData.aluminumSheetsCount < 0) {
            throw new Error('Aluminum sheets count must be a non-negative number');
        }
    }
};

/**
 * Get all phone brands with their models
 * @param {boolean} activeOnly - If true, returns only active brands (default: true)
 * @returns {Promise<Array>} Array of phone brands
 */
const getAllBrands = async () => {
    try {
        // no need for active check here
        const filter = {};
        const brands = await PhoneBrand.find(filter)
            .select('-__v') // Exclude version key
            .sort({ brandName: 1 })
            .lean(); // Return plain JavaScript objects for better performance
        
        return brands;
    } catch (error) {
        throw new Error(`Failed to fetch brands: ${error.message}`);
    }
};

/**
 * Get phone brand by ID
 * @param {string} id - Brand ID
 * @returns {Promise<Object>} Phone brand document
 * @throws {Error} If brand not found or invalid ID
 */
const getBrandById = async (id) => {
    try {
        validateObjectId(id);
        
        const brand = await PhoneBrand.findById(id).select('-__v').lean();
        
        if (!brand) {
            throw new Error('Phone brand not found');
        }
        
        return brand;
    } catch (error) {
        if (error.message === 'Phone brand not found' || error.message === 'Invalid brand ID format') {
            throw error;
        }
        throw new Error(`Failed to fetch brand: ${error.message}`);
    }
};

/**
 * Create a new phone brand
 * @param {Object} brandData - Brand data
 * @param {string} brandData.brandName - Name of the brand
 * @returns {Promise<Object>} Created brand document
 * @throws {Error} If validation fails or brand already exists
 */
const createBrand = async (brandData) => {
    try {
        if (!brandData || typeof brandData !== 'object') {
            throw new Error('Brand data is required');
        }
        
        const sanitizedBrandName = validateBrandName(brandData.brandName);
        
        // Check if brand already exists (case-insensitive)
        const existingBrand = await PhoneBrand.findOne({
            brandName: { $regex: new RegExp(`^${sanitizedBrandName}$`, 'i') }
        });
        
        if (existingBrand) {
            throw new Error('Phone brand with this name already exists');
        }
        
        const newBrand = new PhoneBrand({
            brandName: sanitizedBrandName,
            models: [],
            isActive: true
        });
        
        await newBrand.save();
        return newBrand.toObject();
    } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('required')) {
            throw error;
        }
        throw new Error(`Failed to create brand: ${error.message}`);
    }
};

/**
 * Update phone brand
 * @param {string} id - Brand ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated brand document
 * @throws {Error} If validation fails or brand not found
 */
const updateBrand = async (id, updateData) => {
    try {
        validateObjectId(id);
        
        if (!updateData || typeof updateData !== 'object') {
            throw new Error('Update data is required');
        }
        
        const brand = await PhoneBrand.findById(id);
        
        if (!brand) {
            throw new Error('Phone brand not found');
        }
        
        // If brandName is being updated, validate and check for duplicates
        if (updateData.brandName) {
            const sanitizedBrandName = validateBrandName(updateData.brandName);
            
            const duplicate = await PhoneBrand.findOne({
                _id: { $ne: id },
                brandName: { $regex: new RegExp(`^${sanitizedBrandName}$`, 'i') }
            });
            
            if (duplicate) {
                throw new Error('Phone brand with this name already exists');
            }
            
            brand.brandName = sanitizedBrandName;
        }
        
        // Update models if provided
        if (updateData.models && Array.isArray(updateData.models)) {
            // Validate each model
            updateData.models.forEach(model => validateModelData(model));
            
            brand.models = updateData.models.map(model => ({
                modelName: model.modelName.trim(),
                backCoversCount: model.backCoversCount || 0,
                aluminumSheetsCount: model.aluminumSheetsCount || 0
            }));
        }
        
        
        await brand.save();
        return brand.toObject();
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('already exists') || error.message.includes('Invalid')) {
            throw error;
        }
        throw new Error(`Failed to update brand: ${error.message}`);
    }
};

/**
 * Add model to existing brand
 * @param {string} brandId - Brand ID
 * @param {Object} modelData - Model data
 * @returns {Promise<Object>} Updated brand document
 * @throws {Error} If validation fails or model already exists
 */
const addModelToBrand = async (brandId, modelData) => {
    try {
        validateObjectId(brandId);
        validateModelData(modelData);
        
        const brand = await PhoneBrand.findById(brandId);
        
        if (!brand) {
            throw new Error('Phone brand not found');
        }
        
        const sanitizedModelName = modelData.modelName.trim();
        
        // Check if model already exists (case-insensitive)
        const existingModel = brand.models.find(
            m => m.modelName.toLowerCase() === sanitizedModelName.toLowerCase()
        );
        
        if (existingModel) {
            throw new Error('Model with this name already exists in this brand');
        }
        
        brand.models.push({
            modelName: sanitizedModelName,
            backCoversCount: modelData.backCoversCount || 0,
            aluminumSheetsCount: modelData.aluminumSheetsCount || 0
        });
        
        await brand.save();
        return brand.toObject();
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('already exists') || error.message.includes('required')) {
            throw error;
        }
        throw new Error(`Failed to add model: ${error.message}`);
    }
};

/**
 * Update model in brand
 * @param {string} brandId - Brand ID
 * @param {string} modelId - Model ID
 * @param {Object} updateData - Model update data
 * @returns {Promise<Object>} Updated brand document
 * @throws {Error} If validation fails or model not found
 */
const updateModelInBrand = async (brandId, modelId, updateData) => {
    try {
        validateObjectId(brandId);
        validateObjectId(modelId);
        
        if (!updateData || typeof updateData !== 'object') {
            throw new Error('Update data is required');
        }
        
        const brand = await PhoneBrand.findById(brandId);
        
        if (!brand) {
            throw new Error('Phone brand not found');
        }
        
        const model = brand.models.id(modelId);
        
        if (!model) {
            throw new Error('Model not found in this brand');
        }
        
        // Update model name if provided
        if (updateData.modelName) {
            const sanitizedModelName = updateData.modelName.trim();
            
            if (sanitizedModelName.length === 0 || sanitizedModelName.length > 100) {
                throw new Error('Model name must be between 1 and 100 characters');
            }
            
            // Check for duplicate model name
            const duplicate = brand.models.find(
                m => m._id.toString() !== modelId && 
                     m.modelName.toLowerCase() === sanitizedModelName.toLowerCase()
            );
            
            if (duplicate) {
                throw new Error('Model with this name already exists in this brand');
            }
            
            model.modelName = sanitizedModelName;
        }
        
        // Update counts if provided
        if (updateData.backCoversCount !== undefined) {
            if (typeof updateData.backCoversCount !== 'number' || updateData.backCoversCount < 0) {
                throw new Error('Back covers count must be a non-negative number');
            }
            model.backCoversCount = updateData.backCoversCount;
        }
        
        if (updateData.aluminumSheetsCount !== undefined) {
            if (typeof updateData.aluminumSheetsCount !== 'number' || updateData.aluminumSheetsCount < 0) {
                throw new Error('Aluminum sheets count must be a non-negative number');
            }
            model.aluminumSheetsCount = updateData.aluminumSheetsCount;
        }
        
        await brand.save();
        return brand.toObject();
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('already exists') || error.message.includes('required')) {
            throw error;
        }
        throw new Error(`Failed to update model: ${error.message}`);
    }
};

/**
 * Remove model from brand
 * @param {string} brandId - Brand ID
 * @param {string} modelName - Model name
 * @returns {Promise<Object>} Updated brand document
 * @throws {Error} If brand or model not found
 */
const removeModelFromBrand = async (brandId, modelName) => {
    try {
        validateObjectId(brandId);
        
        if (!modelName || typeof modelName !== 'string') {
            throw new Error('Model name is required');
        }
        
        const brand = await PhoneBrand.findById(brandId);
        
        if (!brand) {
            throw new Error('Phone brand not found');
        }
        
        const modelIndex = brand.models.findIndex(
            m => m.modelName.toLowerCase() === modelName.toLowerCase()
        );
        
        if (modelIndex === -1) {
            throw new Error('Model not found in this brand');
        }
        
        brand.models.splice(modelIndex, 1);
        
        await brand.save();
        return brand.toObject();
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('required')) {
            throw error;
        }
        throw new Error(`Failed to remove model: ${error.message}`);
    }
};



/**
 * Delete phone brand (hard delete - use with caution)
 * @param {string} id - Brand ID
 * @returns {Promise<Object>} Deleted brand document
 * @throws {Error} If brand not found
 */
const deleteBrand = async (id) => {
    try {
        validateObjectId(id);
        
        const brand = await PhoneBrand.findByIdAndDelete(id);
        
        if (!brand) {
            throw new Error('Phone brand not found');
        }
        
        return brand.toObject();
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('Invalid')) {
            throw error;
        }
        throw new Error(`Failed to delete brand: ${error.message}`);
    }
};

/**
 * Search brands by name
 * @param {string} searchTerm - Search term
 * @param {boolean} activeOnly - Filter by active status
 * @returns {Promise<Array>} Matching brands
 */
const searchBrands = async (searchTerm, activeOnly = true) => {
    try {
        if (!searchTerm || typeof searchTerm !== 'string') {
            throw new Error('Search term is required');
        }
        
        const sanitizedTerm = searchTerm.trim();
        
        if (sanitizedTerm.length === 0) {
            return getAllBrands(activeOnly);
        }
        
        const filter = {
            brandName: { $regex: sanitizedTerm, $options: 'i' }
        };
        
        if (activeOnly) {
            filter.isActive = true;
        }
        
        const brands = await PhoneBrand.find(filter)
            .select('-__v')
            .sort({ brandName: 1 })
            .lean();
        
        return brands;
    } catch (error) {
        throw new Error(`Failed to search brands: ${error.message}`);
    }
};

module.exports = {
    getAllBrands,
    getBrandById,
    createBrand,
    updateBrand,
    addModelToBrand,
    updateModelInBrand,
    removeModelFromBrand,
    deleteBrand,
    searchBrands
};
