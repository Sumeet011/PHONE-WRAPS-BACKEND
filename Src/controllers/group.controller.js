const {
  createGroup,
  getGroupById,
  getAllGroups,
  addCollectionToGroup,
  removeCollectionFromGroup,
  updateGroup,
  deleteGroup,
} = require('../../Models/Group/Group.service');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  const group = await createGroup(req.body);
  res.status(201).json({ success: true, data: group });
});

exports.getById = asyncHandler(async (req, res) => {
  const group = await getGroupById(req.params.id);
  res.status(200).json({ success: true, data: group });
});

exports.list = asyncHandler(async (req, res) => {
  const { limit, page, sort } = req.query;
  const result = await getAllGroups({ limit, page, sort });
  res.status(200).json({ success: true, ...result });
});

exports.update = asyncHandler(async (req, res) => {
  const group = await updateGroup(req.params.id, req.body);
  res.status(200).json({ success: true, data: group });
});

exports.remove = asyncHandler(async (req, res) => {
  await deleteGroup(req.params.id);
  res.status(200).json({ success: true, message: 'Group deleted successfully' });
});

exports.addCollection = asyncHandler(async (req, res) => {
  const { collectionId } = req.body;
  const group = await addCollectionToGroup(req.params.id, collectionId);
  res.status(200).json({ success: true, data: group });
});

exports.removeCollection = asyncHandler(async (req, res) => {
  const { collectionId } = req.body;
  const group = await removeCollectionFromGroup(req.params.id, collectionId);
  res.status(200).json({ success: true, data: group });
});
