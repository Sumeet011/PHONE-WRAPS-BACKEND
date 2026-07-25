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
  
  // Debug: Check collection type before adding
  const Collection = require('../Collection/Collection.model');
  const collection = await Collection.findById(collectionId);
  console.log('📋 Collection to add:', {
    id: collectionId,
    name: collection?.name,
    type: collection?.type,
    exists: !!collection
  });
  
  if (!collection) throw new Error('Collection not found');
  if (collection.type !== 'gaming') {
    throw new Error('Only gaming collections can be added to groups');
  }
  
  // Avoid duplicates
  if (!group.collections.includes(collectionId)) {
    group.collections.push(collectionId);
    await group.save();
  }
  
  // Return populated group
  return await Group.findById(groupId).populate({
    path: 'collections',
    populate: { path: 'products' }
  });
};

const removeCollectionFromGroup = async (groupId, collectionId) => {
  if (!groupId || !collectionId) throw new Error("Group id and collection id are required");

  const group = await Group.findByIdAndUpdate(
    groupId,
    { $pull: { collections: collectionId } },
    { new: true }
  );

  if (!group) throw new Error("Group not found");

  return group;
};

const getGroupById = async (groupId) => {
  if (!groupId) throw new Error("Group id is required");

  const group = await Group.findById(groupId).populate({
    path: 'collections',
    populate: { path: 'products' }
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
      .populate('collections')
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
