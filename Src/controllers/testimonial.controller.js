const testimonialService = require('../../Models/Testimonial/Testimonial.service');
const { uploadToCloudinary } = require('../config/cloudinary');

// Get all testimonials (admin)
exports.getAllTestimonials = async (req, res) => {
  try {
    const testimonials = await testimonialService.getAllTestimonials();
    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get active testimonials (public)
exports.getActiveTestimonials = async (req, res) => {
  try {
    const testimonials = await testimonialService.getActiveTestimonials();
    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single testimonial
exports.getTestimonialById = async (req, res) => {
  try {
    const testimonial = await testimonialService.getTestimonialById(req.params.id);
    res.status(200).json({
      success: true,
      data: testimonial
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// Create testimonial
exports.createTestimonial = async (req, res) => {
  try {
    const { name, title, quote, rating, isActive, order } = req.body;

    // Validate required fields
    if (!name || !title || !quote) {
      return res.status(400).json({
        success: false,
        message: 'Name, title, and quote are required'
      });
    }

    let imageUrl = '';

    // Handle image upload if provided
    if (req.files && req.files.image) {
      const result = await uploadToCloudinary(req.files.image[0].path, 'testimonials');
      imageUrl = result.secure_url;
    } else if (req.body.image) {
      imageUrl = req.body.image;
    }

    const testimonialData = {
      name,
      title,
      quote,
      image: imageUrl,
      rating: rating || 5,
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0
    };

    const testimonial = await testimonialService.createTestimonial(testimonialData);

    res.status(201).json({
      success: true,
      message: 'Testimonial created successfully',
      data: testimonial
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update testimonial
exports.updateTestimonial = async (req, res) => {
  try {
    const { name, title, quote, rating, isActive, order } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (quote !== undefined) updateData.quote = quote;
    if (rating !== undefined) updateData.rating = rating;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (order !== undefined) updateData.order = order;

    // Handle image update
    if (req.files && req.files.image) {
      const result = await uploadToCloudinary(req.files.image[0].path, 'testimonials');
      updateData.image = result.secure_url;
    } else if (req.body.image !== undefined) {
      updateData.image = req.body.image;
    }

    const testimonial = await testimonialService.updateTestimonial(req.params.id, updateData);

    res.status(200).json({
      success: true,
      message: 'Testimonial updated successfully',
      data: testimonial
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete testimonial
exports.deleteTestimonial = async (req, res) => {
  try {
    await testimonialService.deleteTestimonial(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Testimonial deleted successfully'
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle active status
exports.toggleActiveStatus = async (req, res) => {
  try {
    const testimonial = await testimonialService.toggleActiveStatus(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Testimonial status updated successfully',
      data: testimonial
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update order
exports.updateOrder = async (req, res) => {
  try {
    const { order } = req.body;
    if (order === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Order value is required'
      });
    }

    const testimonial = await testimonialService.updateOrder(req.params.id, order);
    res.status(200).json({
      success: true,
      message: 'Testimonial order updated successfully',
      data: testimonial
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
