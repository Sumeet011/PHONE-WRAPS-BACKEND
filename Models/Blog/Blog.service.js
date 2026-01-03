const Blog = require('./Blog.model');

class BlogService {
  // Create a new blog post
  async createBlog(blogData) {
    try {
      const blog = new Blog(blogData);
      await blog.save();
      return blog;
    } catch (error) {
      throw new Error(`Error creating blog: ${error.message}`);
    }
  }

  // Get all blogs with optional filters
  async getAllBlogs(filters = {}) {
    try {
      const query = {};
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { excerpt: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Select only necessary fields for blog list to improve performance
      const blogs = await Blog.find(query)
        .select('_id title excerpt image author category status createdAt updatedAt views')
        .sort({ createdAt: -1 })
        .lean(); // Use lean() for faster queries when we don't need mongoose documents
      
      return blogs;
    } catch (error) {
      throw new Error(`Error fetching blogs: ${error.message}`);
    }
  }

  // Get a single blog by ID
  async getBlogById(blogId) {
    try {
      const blog = await Blog.findById(blogId);
      if (!blog) {
        throw new Error('Blog not found');
      }
      return blog;
    } catch (error) {
      throw new Error(`Error fetching blog: ${error.message}`);
    }
  }

  // Update a blog
  async updateBlog(blogId, updateData) {
    try {
      const blog = await Blog.findByIdAndUpdate(
        blogId,
        { ...updateData, updatedAt: Date.now() },
        { new: true, runValidators: true }
      );
      
      if (!blog) {
        throw new Error('Blog not found');
      }
      
      return blog;
    } catch (error) {
      throw new Error(`Error updating blog: ${error.message}`);
    }
  }

  // Delete a blog
  async deleteBlog(blogId) {
    try {
      const blog = await Blog.findByIdAndDelete(blogId);
      if (!blog) {
        throw new Error('Blog not found');
      }
      return blog;
    } catch (error) {
      throw new Error(`Error deleting blog: ${error.message}`);
    }
  }

  // Increment blog views
  async incrementViews(blogId) {
    try {
      const blog = await Blog.findByIdAndUpdate(
        blogId,
        { $inc: { views: 1 } },
        { new: true }
      );
      return blog;
    } catch (error) {
      throw new Error(`Error incrementing views: ${error.message}`);
    }
  }
}

module.exports = new BlogService();
