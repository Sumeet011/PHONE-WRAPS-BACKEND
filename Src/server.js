// app.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require('cors');
const morgan = require('morgan'); // optional: logging for dev

// Load environment variables FIRST before anything else
dotenv.config({ path: __dirname + '/.env' });

// Verify required environment variables
const requiredEnvVars = ['MONGODB_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file');
  process.exit(1);
}


// NOW load custom modules that depend on env vars
const { connectDB } = require('./config/db');
const { errorMiddleware } = require('./utils/errors');
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const collectionRoutes = require('./routes/collections.routes');
const groupRoutes = require('./routes/group.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRouter = require('./routes/order.routes');
const couponRoutes = require('./routes/coupon.routes');
const customDesignRoutes = require('./routes/customDesign.routes');
const blogRoutes = require('./routes/blog.routes');
const designAssetRoutes = require('./routes/designAsset.routes');

// Create Express app
const app = express();

// Middleware
// Increase payload size limit for base64 image uploads (custom designs)
app.use(express.json({ limit: '50mb' })); // parse JSON bodies with 50MB limit
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // parse URL-encoded bodies with 50MB limit

// Optional: logger for development
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// CORS - Allow frontend to access backend
app.use(cors({
  origin: ['http://localhost:4000','http://localhost:5174', 'http://localhost:3001', 'http://localhost:3000', 'https://wraps-brand.vercel.app', 'https://phone-wraps-admin.vercel.app','https://fantastic-cod-5g44q797xwr4h79vg-3000.app.github.dev','https://phone-wraps.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'User-Id', 'token']
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/collections',collectionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRouter);
app.use('/api/coupon', couponRoutes);
app.use('/api/custom-design', customDesignRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/design-assets', designAssetRoutes);

// Default 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Centralized error handler
app.use(errorMiddleware);

// Start server after MongoDB connection
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined in .env");
  process.exit(1);
}

// Start server after MongoDB connection
let server;

connectDB(MONGODB_URI)
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
  }
  
  try {
    const { disconnectDB } = require('./config/db');
    await disconnectDB();
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.error(error.name, error.message);
  console.error(error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...');
  console.error(error);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app; // Export for testing
