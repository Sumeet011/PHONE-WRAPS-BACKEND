const User = require('../../Models/User/User.model');

/**
 * Calculate user score based on gaming card levels
 * @param {String} userId - User ID
 * @returns {Number} - Calculated score
 */
exports.calculateUserScore = async (userId) => {
  try {
    const user = await User.findById(userId).populate('gamingCollections.cards.productId');

    if (!user) {
      throw new Error('User not found');
    }

    let totalScore = 0;
    
    for (const collection of user.gamingCollections || []) {
      for (const card of collection.cards || []) {
        if (card.productId && card.productId.level) {
          const level = parseInt(card.productId.level) || 0;
          totalScore += level;
        }
      }
    }
    
    return totalScore;
  } catch (error) {
    console.error('Error calculating user score:', error);
    return 0;
  }
};

/**
 * Update user score in database
 * @param {String} userId - User ID
 * @returns {Object} - Updated user data
 */
exports.updateUserScore = async (userId) => {
  try {
    const totalScore = await this.calculateUserScore(userId);
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { score: totalScore } },
      { new: true }
    );
    
    return {
      success: true,
      userId: user._id,
      score: totalScore
    };
  } catch (error) {
    console.error('Error updating user score:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Recalculate scores for all users
 * @returns {Object} - Summary of updates
 */
exports.recalculateAllScores = async () => {
  try {
    const users = await User.find({}).select('_id');
    const results = [];
    
    for (const user of users) {
      const result = await this.updateUserScore(user._id);
      results.push(result);
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return {
      success: true,
      totalUsers: users.length,
      successful,
      failed,
      message: `Updated ${successful} users, ${failed} failed`
    };
  } catch (error) {
    console.error('Error recalculating all scores:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
