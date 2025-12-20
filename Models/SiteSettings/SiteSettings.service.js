const SiteSettings = require('./SiteSettings.model');

class SiteSettingsService {
  /**
   * Get site settings
   */
  async getSettings() {
    try {
      const settings = await SiteSettings.getSettings();
      return {
        success: true,
        data: settings
      };
    } catch (error) {
      console.error('Error fetching site settings:', error);
      return {
        success: false,
        message: 'Failed to fetch site settings',
        error: error.message
      };
    }
  }

  /**
   * Update site settings
   */
  async updateSettings(updates) {
    try {
      // Validate numeric fields
      const numericFields = [
        'textScrollVelocity',
        'gamingCollectionsLimit',
        'nonGamingCollectionsLimit',
        'productsPerRow',
        'productsRows'
      ];

      numericFields.forEach(field => {
        if (updates[field] !== undefined) {
          const value = Number(updates[field]);
          if (isNaN(value) || value < 1) {
            throw new Error(`${field} must be a positive number`);
          }
          updates[field] = value;
        }
      });

      const settings = await SiteSettings.updateSettings(updates);
      
      return {
        success: true,
        data: settings,
        message: 'Settings updated successfully'
      };
    } catch (error) {
      console.error('Error updating site settings:', error);
      return {
        success: false,
        message: 'Failed to update site settings',
        error: error.message
      };
    }
  }

  /**
   * Reset settings to default
   */
  async resetSettings() {
    try {
      await SiteSettings.findByIdAndDelete('site_settings');
      const settings = await SiteSettings.getSettings();
      
      return {
        success: true,
        data: settings,
        message: 'Settings reset to defaults'
      };
    } catch (error) {
      console.error('Error resetting site settings:', error);
      return {
        success: false,
        message: 'Failed to reset site settings',
        error: error.message
      };
    }
  }
}

module.exports = new SiteSettingsService();
