const CollectionTooltipService = require('../../Models/CollectionTooltip/CollectionTooltip.service');

/**
 * Get all collection tooltips
 */
const getTooltips = async (req, res) => {
  try {
    const tooltips = await CollectionTooltipService.getTooltips();
    
    res.status(200).json({
      success: true,
      data: tooltips
    });
  } catch (error) {
    console.error('Error in getTooltips:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch collection tooltips'
    });
  }
};

/**
 * Get tooltip for a specific quantity
 */
const getTooltipByQuantity = async (req, res) => {
  try {
    const { quantity } = req.params;
    const quantityNum = parseInt(quantity);

    if (isNaN(quantityNum) || quantityNum < 1 || quantityNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity. Must be between 1 and 5'
      });
    }

    const tooltip = await CollectionTooltipService.getTooltipByQuantity(quantityNum);
    
    res.status(200).json({
      success: true,
      data: tooltip
    });
  } catch (error) {
    console.error('Error in getTooltipByQuantity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tooltip'
    });
  }
};

/**
 * Update all tooltips
 */
const updateTooltips = async (req, res) => {
  try {
    const { tooltips } = req.body;

    if (!tooltips) {
      return res.status(400).json({
        success: false,
        message: 'Tooltips data is required'
      });
    }

    const updatedConfig = await CollectionTooltipService.updateTooltips(tooltips);
    
    res.status(200).json({
      success: true,
      message: 'Collection tooltips updated successfully',
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error in updateTooltips:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update collection tooltips'
    });
  }
};

/**
 * Update a single tooltip
 */
const updateTooltip = async (req, res) => {
  try {
    const { quantity } = req.params;
    const { title, message } = req.body;
    const quantityNum = parseInt(quantity);

    if (isNaN(quantityNum) || quantityNum < 1 || quantityNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity. Must be between 1 and 5'
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    const updatedConfig = await CollectionTooltipService.updateTooltip(quantityNum, title, message);
    
    res.status(200).json({
      success: true,
      message: `Tooltip for quantity ${quantityNum} updated successfully`,
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error in updateTooltip:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update tooltip'
    });
  }
};

module.exports = {
  getTooltips,
  getTooltipByQuantity,
  updateTooltips,
  updateTooltip
};
