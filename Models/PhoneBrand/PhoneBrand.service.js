const PhoneBrand = require('./PhoneBrand.model');

/**
 * Get all phone brands with their models
 */
const getAllBrands = async (activeOnly = false) => {
    const filter = activeOnly ? { isActive: true } : {};
    return await PhoneBrand.find(filter).sort({ brandName: 1 });
};

/**
 * Get phone brand by ID
 */
const getBrandById = async (id) => {
    const brand = await PhoneBrand.findById(id);
    if (!brand) {
        throw new Error('Phone brand not found');
    }
    return brand;
};



/**
 * Create a new phone brand
 */
const createBrand = async (brandData) => {
    const { brandName, models = [] } = brandData;

    // Check if brand already exists
    const existingBrand = await PhoneBrand.findOne({ brandName: brandName });

    if (existingBrand) {
        throw new Error('Phone brand with this name already exists');
    }

    const newBrand = new PhoneBrand({
        brandName,
        models: models.map(model => ({
            modelName: model.modelName
        })),
        isActive: true
    });

    await newBrand.save();
    return newBrand;
};

/**
 * Update phone brand
 */
const updateBrand = async (id, updateData) => {
    const brand = await PhoneBrand.findById(id);
    if (!brand) {
        throw new Error('Phone brand not found');
    }

    // If brandName is being updated, check for duplicates
    if (updateData.brandName) {
        const duplicate = await PhoneBrand.findOne({
            _id: { $ne: id },
            brandName: updateData.brandName
        });
        if (duplicate) {
            throw new Error('Phone brand with this name already exists');
        }
    }

    // Update fields
    if (updateData.brandName) brand.brandName = updateData.brandName;
    if (updateData.models) {
        brand.models = updateData.models.map(model => ({
            modelName: model.modelName
        }));
    }
    if (typeof updateData.isActive === 'boolean') brand.isActive = updateData.isActive;

    await brand.save();
    return brand;
};

/**
 * Add model to existing brand
 */
const addModelToBrand = async (brandId, modelData) => {
    const brand = await PhoneBrand.findById(brandId);
    if (!brand) {
        throw new Error('Phone brand not found');
    }

    // Check if model already exists
    const existingModel = brand.models.find(
        m => m.modelName === modelData.modelName
    );

    if (existingModel) {
        throw new Error('Model with this name already exists in this brand');
    }

    brand.models.push({
        modelName: modelData.modelName
    });

    await brand.save();
    return brand;
};

/**
 * Remove model from brand
 */
const removeModelFromBrand = async (brandId, modelName) => {
    const brand = await PhoneBrand.findById(brandId);
    if (!brand) {
        throw new Error('Phone brand not found');
    }

    brand.models = brand.models.filter(
        m => m.modelName !== modelName
    );

    await brand.save();
    return brand;
};

/**
 * Delete phone brand
 */
const deleteBrand = async (id) => {
    const brand = await PhoneBrand.findById(id);
    if (!brand) {
        throw new Error('Phone brand not found');
    }

    await PhoneBrand.findByIdAndDelete(id);
    return brand;
};

/**
 * Toggle brand active status
 */
const toggleBrandStatus = async (id) => {
    const brand = await PhoneBrand.findById(id);
    if (!brand) {
        throw new Error('Phone brand not found');
    }

    brand.isActive = !brand.isActive;
    await brand.save();
    return brand;
};

module.exports = {
    getAllBrands,
    getBrandById,
    createBrand,
    updateBrand,
    addModelToBrand,
    removeModelFromBrand,
    deleteBrand,
    toggleBrandStatus
};
