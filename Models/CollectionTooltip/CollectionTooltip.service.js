const CollectionTooltip = require('./CollectionTooltip.model');

class CollectionTooltipService {
  /**
   * Get the collection tooltip configuration
   */
  async getTooltips() {
    try {
      const config = await CollectionTooltip.getSingleton();
      return config;
    } catch (error) {
      throw new Error(`Error fetching tooltips: ${error.message}`);
    }
  }

  /**
   * Get tooltip for a specific quantity
   */
  async getTooltipByQuantity(quantity) {
    try {
      const config = await CollectionTooltip.getSingleton();
      const tooltip = config.tooltips.find(t => t.quantity === quantity);
      
      if (!tooltip) {
        throw new Error(`No tooltip found for quantity ${quantity}`);
      }
      
      return tooltip;
    } catch (error) {
      throw new Error(`Error fetching tooltip for quantity ${quantity}: ${error.message}`);
    }
  }

  /**
   * Update all tooltips
   */
  async updateTooltips(tooltipsData) {
    try {
      // Validate that we have exactly 5 tooltips
      if (!Array.isArray(tooltipsData) || tooltipsData.length !== 5) {
        throw new Error('Must provide exactly 5 tooltips (one for each quantity 1-5)');
      }

      // Validate each tooltip has required fields
      for (const tooltip of tooltipsData) {
        if (!tooltip.quantity || !tooltip.title || !tooltip.message) {
          throw new Error('Each tooltip must have quantity, title, and message');
        }
        if (tooltip.quantity < 1 || tooltip.quantity > 5) {
          throw new Error('Quantity must be between 1 and 5');
        }
      }

      const config = await CollectionTooltip.getSingleton();
      config.tooltips = tooltipsData;
      await config.save();
      
      return config;
    } catch (error) {
      throw new Error(`Error updating tooltips: ${error.message}`);
    }
  }

  /**
   * Update a single tooltip
   */
  async updateTooltip(quantity, title, message) {
    try {
      if (quantity < 1 || quantity > 5) {
        throw new Error('Quantity must be between 1 and 5');
      }

      const config = await CollectionTooltip.getSingleton();
      const tooltipIndex = config.tooltips.findIndex(t => t.quantity === quantity);
      
      if (tooltipIndex === -1) {
        throw new Error(`No tooltip found for quantity ${quantity}`);
      }

      config.tooltips[tooltipIndex].title = title;
      config.tooltips[tooltipIndex].message = message;
      
      await config.save();
      
      return config;
    } catch (error) {
      throw new Error(`Error updating tooltip for quantity ${quantity}: ${error.message}`);
    }
  }
}

module.exports = new CollectionTooltipService();
