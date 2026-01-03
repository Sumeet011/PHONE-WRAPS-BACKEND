const blogService = require('../../Models/Blog/Blog.service');
const { uploadToCloudinary } = require('../config/cloudinary');

// Create a new blog post
exports.createBlog = async (req, res) => {
  try {
    const { title, excerpt, content, contentBlocks, author, status, category, tags } = req.body;

    // Validate required fields
    if (!title || !excerpt) {
      return res.status(400).json({
        success: false,
        message: 'Title and excerpt are required'
      });
    }

    // Must have either content or contentBlocks
    if (!content && (!contentBlocks || contentBlocks.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Content or content blocks are required'
      });
    }

    let imageUrl = '';
    const uploadedImages = [];

    // Handle featured/cover image upload
    if (req.files && req.files.image) {
      const result = await uploadToCloudinary(req.files.image[0].path, 'blogs/covers');
      imageUrl = result.secure_url;
    } else if (req.body.image) {
      imageUrl = req.body.image;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Blog cover image is required'
      });
    }

    // Handle multiple content images upload
    if (req.files && req.files.contentImages) {
      console.log('📸 Uploading content images:', req.files.contentImages.length);
      for (const file of req.files.contentImages) {
        console.log('  - Uploading:', file.originalname);
        const result = await uploadToCloudinary(file.path, 'blogs/content');
        console.log('  ✓ Uploaded to:', result.secure_url);
        uploadedImages.push({
          url: result.secure_url,
          alt: file.originalname,
          caption: ''
        });
      }
      console.log('✅ Total uploaded images:', uploadedImages.length);
    } else {
      console.log('⚠️ No content images found in request');
      if (req.files) {
        console.log('Available files:', Object.keys(req.files));
      }
    }

    // Parse contentBlocks if sent as JSON string
    let parsedContentBlocks = contentBlocks;
    if (typeof contentBlocks === 'string') {
      try {
        parsedContentBlocks = JSON.parse(contentBlocks);
      } catch (e) {
        parsedContentBlocks = null;
      }
    }

    // Map uploaded images back to content blocks
    if (parsedContentBlocks && uploadedImages.length > 0) {
      parsedContentBlocks = parsedContentBlocks.map(block => {
        if (block.type === 'image' && block.imageIndex !== undefined) {
          // Replace imageIndex with actual uploaded URL
          const uploadedImage = uploadedImages[block.imageIndex];
          if (uploadedImage) {
            return {
              type: 'image',
              content: uploadedImage.url,
              alt: block.alt || uploadedImage.alt || '',
              caption: block.caption || ''
            };
          }
        }
        return block;
      });
    }

    const blogData = {
      title,
      excerpt,
      content: content || '', // For backward compatibility
      contentBlocks: parsedContentBlocks || [],
      image: imageUrl,
      images: uploadedImages,
      author: author || 'Admin',
      status: status || 'draft',
      category: category || 'General',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : []
    };

    const blog = await blogService.createBlog(blogData);

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      blog,
      uploadedImages // Return uploaded image URLs for client reference
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create blog'
    });
  }
};

// Get all blogs
exports.getAllBlogs = async (req, res) => {
  try {
    const { status, category, search } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (search) filters.search = search;

    const blogs = await blogService.getAllBlogs(filters);

    res.status(200).json({
      success: true,
      count: blogs.length,
      blogs
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch blogs'
    });
  }
};

// Get a single blog by ID
exports.getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await blogService.getBlogById(id);

    // Increment view count
    await blogService.incrementViews(id);

    res.status(200).json({
      success: true,
      blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(404).json({
      success: false,
      message: error.message || 'Blog not found'
    });
  }
};

// Update a blog
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, contentBlocks, author, status, category, tags } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (excerpt) updateData.excerpt = excerpt;
    if (content) updateData.content = content;
    if (author) updateData.author = author;
    if (status) updateData.status = status;
    if (category) updateData.category = category;
    if (tags) updateData.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());

    // Parse contentBlocks if sent as JSON string
    if (contentBlocks) {
      if (typeof contentBlocks === 'string') {
        try {
          updateData.contentBlocks = JSON.parse(contentBlocks);
        } catch (e) {
          console.error('Error parsing contentBlocks:', e);
        }
      } else {
        updateData.contentBlocks = contentBlocks;
      }
    }

    // Handle cover image upload if new image is provided
    if (req.files && req.files.image) {
      const result = await uploadToCloudinary(req.files.image[0].path, 'blogs/covers');
      updateData.image = result.secure_url;
    } else if (req.body.image) {
      updateData.image = req.body.image;
    }

    // Handle additional content images
    if (req.files && req.files.contentImages) {
      const uploadedImages = [];
      for (const file of req.files.contentImages) {
        const result = await uploadToCloudinary(file.path, 'blogs/content');
        uploadedImages.push({
          url: result.secure_url,
          alt: file.originalname,
          caption: ''
        });
      }
      
      // Get existing blog to merge images
      const existingBlog = await blogService.getBlogById(id);
      updateData.images = [...(existingBlog.images || []), ...uploadedImages];
      
      // Map uploaded images back to content blocks
      if (updateData.contentBlocks && uploadedImages.length > 0) {
        updateData.contentBlocks = updateData.contentBlocks.map(block => {
          if (block.type === 'image' && block.imageIndex !== undefined) {
            // Replace imageIndex with actual uploaded URL
            const uploadedImage = uploadedImages[block.imageIndex];
            if (uploadedImage) {
              return {
                type: 'image',
                content: uploadedImage.url,
                alt: block.alt || uploadedImage.alt || '',
                caption: block.caption || ''
              };
            }
          }
          return block;
        });
      }
    }

    const blog = await blogService.updateBlog(id, updateData);

    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      blog
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update blog'
    });
  }
};

// Delete a blog
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    await blogService.deleteBlog(id);

    res.status(200).json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete blog'
    });
  }
};
