const DesignAsset = require('./DesignAsset.model');

const createDesignAsset = async (data) => {
  if (!data) throw new Error('Design asset data is required');
  const asset = await DesignAsset.create(data);
  return asset;
};

const getAllDesignAssets = async (filters = {}) => {
  const { category, isActive, tags, limit = 50, page = 1 } = filters;
  const skip = (page - 1) * limit;

  const query = {};
  if (category) query.category = category;
  if (isActive !== undefined) query.isActive = isActive;
  if (tags && tags.length > 0) query.tags = { $in: tags };

  const [assets, total] = await Promise.all([
    DesignAsset.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    DesignAsset.countDocuments(query)
  ]);

  return {
    items: assets,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};

const getDesignAssetById = async (id) => {
  if (!id) throw new Error('Design asset ID is required');
  const asset = await DesignAsset.findById(id);
  if (!asset) throw new Error('Design asset not found');
  return asset;
};

const updateDesignAsset = async (id, data) => {
  if (!id || !data) throw new Error('ID and data are required');
  const asset = await DesignAsset.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!asset) throw new Error('Design asset not found');
  return asset;
};

const deleteDesignAsset = async (id) => {
  if (!id) throw new Error('Design asset ID is required');
  const asset = await DesignAsset.findByIdAndDelete(id);
  if (!asset) throw new Error('Design asset not found');
  return asset;
};

const incrementUsageCount = async (id) => {
  if (!id) throw new Error('Design asset ID is required');
  await DesignAsset.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });
};

module.exports = {
  createDesignAsset,
  getAllDesignAssets,
  getDesignAssetById,
  updateDesignAsset,
  deleteDesignAsset,
  incrementUsageCount
};
