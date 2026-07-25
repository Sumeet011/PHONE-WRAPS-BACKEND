const Testimonial = require('./Testimonial.model');

class TestimonialService {
  // Get all testimonials with optional filtering
  async getAllTestimonials(filter = {}) {
    try {
      const testimonials = await Testimonial.find(filter)
        .sort({ order: 1, createdAt: -1 });
      return testimonials;
    } catch (error) {
      throw new Error(`Error fetching testimonials: ${error.message}`);
    }
  }

  // Get active testimonials only (for frontend)
  async getActiveTestimonials() {
    try {
      const testimonials = await Testimonial.find({ isActive: true })
        .sort({ order: 1, createdAt: -1 });
      return testimonials;
    } catch (error) {
      throw new Error(`Error fetching active testimonials: ${error.message}`);
    }
  }

  // Get single testimonial by ID
  async getTestimonialById(id) {
    try {
      const testimonial = await Testimonial.findById(id);
      if (!testimonial) {
        throw new Error('Testimonial not found');
      }
      return testimonial;
    } catch (error) {
      throw new Error(`Error fetching testimonial: ${error.message}`);
    }
  }

  // Create new testimonial
  async createTestimonial(data) {
    try {
      const testimonial = new Testimonial(data);
      await testimonial.save();
      return testimonial;
    } catch (error) {
      throw new Error(`Error creating testimonial: ${error.message}`);
    }
  }

  // Update testimonial
  async updateTestimonial(id, data) {
    try {
      const testimonial = await Testimonial.findByIdAndUpdate(
        id,
        data,
        { new: true, runValidators: true }
      );
      if (!testimonial) {
        throw new Error('Testimonial not found');
      }
      return testimonial;
    } catch (error) {
      throw new Error(`Error updating testimonial: ${error.message}`);
    }
  }

  // Delete testimonial
  async deleteTestimonial(id) {
    try {
      const testimonial = await Testimonial.findByIdAndDelete(id);
      if (!testimonial) {
        throw new Error('Testimonial not found');
      }
      return testimonial;
    } catch (error) {
      throw new Error(`Error deleting testimonial: ${error.message}`);
    }
  }

  // Toggle active status
  async toggleActiveStatus(id) {
    try {
      const testimonial = await Testimonial.findById(id);
      if (!testimonial) {
        throw new Error('Testimonial not found');
      }
      testimonial.isActive = !testimonial.isActive;
      await testimonial.save();
      return testimonial;
    } catch (error) {
      throw new Error(`Error toggling testimonial status: ${error.message}`);
    }
  }

  // Update order/position
  async updateOrder(id, newOrder) {
    try {
      const testimonial = await Testimonial.findByIdAndUpdate(
        id,
        { order: newOrder },
        { new: true }
      );
      if (!testimonial) {
        throw new Error('Testimonial not found');
      }
      return testimonial;
    } catch (error) {
      throw new Error(`Error updating testimonial order: ${error.message}`);
    }
  }
}

module.exports = new TestimonialService();
