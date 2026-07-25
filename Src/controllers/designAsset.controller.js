const {
  createDesignAsset,
  getAllDesignAssets,
  getDesignAssetById,
  updateDesignAsset,
  deleteDesignAsset
} = require('../../Models/DesignAsset/DesignAsset.service');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  // Add image URL from uploaded file
  if (req.file && req.file.path) {
    req.body.imageUrl = req.file.path;
  }

  const asset = await createDesignAsset(req.body);
  res.status(201).json({ 
    success: true, 
    message: 'Design asset created successfully',
    data: asset 
  });
});

exports.list = asyncHandler(async (req, res) => {
  const { category, isActive, limit, page } = req.query;
  const result = await getAllDesignAssets({ 
    category, 
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    limit: limit ? parseInt(limit) : undefined,
    page: page ? parseInt(page) : undefined
  });
  res.status(200).json({ success: true, ...result });
});

exports.getById = asyncHandler(async (req, res) => {
  const asset = await getDesignAssetById(req.params.id);
  res.status(200).json({ success: true, data: asset });
});

exports.update = asyncHandler(async (req, res) => {
  // Add image URL from uploaded file if new image is uploaded
  if (req.file && req.file.path) {
    req.body.imageUrl = req.file.path;
  }

  const asset = await updateDesignAsset(req.params.id, req.body);
  res.status(200).json({ 
    success: true, 
    message: 'Design asset updated successfully',
    data: asset 
  });
});

exports.remove = asyncHandler(async (req, res) => {
  await deleteDesignAsset(req.params.id);
  res.status(200).json({ 
    success: true, 
    message: 'Design asset deleted successfully' 
  });
});
