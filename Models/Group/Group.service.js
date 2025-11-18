const Group = require('./Group.model');

const createGroup = async (groupData) => {
  if (!groupData) throw new Error("Group data is required");
  
  const group = await Group.create(groupData);
  return group;
};

const addCollectionToGroup = async (groupId, collectionId) => {
  if (!groupId || !collectionId) throw new Error("Group id and collection id are required");

  const group = await Group.findById(groupId);
  if (!group) throw new Error('Group not found');
  
  // Avoid duplicates
  if (!group.members.includes(collectionId)) {
    group.members.push(collectionId);
    await group.save();
  }
  
  return group;
};

const removeCollectionFromGroup = async (groupId, collectionId) => {
  if (!groupId || !collectionId) throw new Error("Group id and collection id are required");

  const group = await Group.findByIdAndUpdate(
    groupId,
    { $pull: { members: collectionId } },
    { new: true }
  );

  if (!group) throw new Error("Group not found");

  return group;
};

const getGroupById = async (groupId) => {
  if (!groupId) throw new Error("Group id is required");

  const group = await Group.findById(groupId).populate({
    path: 'members',
    populate: { path: 'Products' }
  });
  
  if (!group) throw new Error("Group not found");

  return group;
};

const getAllGroups = async (options = {}) => {
  const limit = options.limit || 20;
  const page = options.page || 1;
  const skip = (page - 1) * limit;

  const [groups, total] = await Promise.all([
    Group.find()
      .populate('members')
      .sort(options.sort || '-createdAt')
      .skip(skip)
      .limit(limit),
    Group.countDocuments()
  ]);

  return {
    items: groups,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

const updateGroup = async (groupId, updateData) => {
  if (!groupId || !updateData) throw new Error("Group id and update data are required");

  const group = await Group.findByIdAndUpdate(
    groupId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
  
  if (!group) throw new Error("Group not found");

  return group;
};

const deleteGroup = async (groupId) => {
  if (!groupId) throw new Error("Group id is required");

  const deleted = await Group.findByIdAndDelete(groupId);
  if (!deleted) throw new Error("Group not found");

  return deleted;
};

module.exports = {
  createGroup,
  getGroupById,
  getAllGroups,
  addCollectionToGroup,
  removeCollectionFromGroup,
  updateGroup,
  deleteGroup,
};
