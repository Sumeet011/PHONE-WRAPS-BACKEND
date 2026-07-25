const siteSettingsService = require('../../Models/SiteSettings/SiteSettings.service');

/**
 * Get site settings
 */
exports.getSettings = async (req, res) => {
  try {
    const result = await siteSettingsService.getSettings();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error in getSettings controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update site settings (Admin only)
 */
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    const result = await siteSettingsService.updateSettings(updates);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error in updateSettings controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Reset settings to default (Admin only)
 */
exports.resetSettings = async (req, res) => {
  try {
    const result = await siteSettingsService.resetSettings();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error in resetSettings controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
