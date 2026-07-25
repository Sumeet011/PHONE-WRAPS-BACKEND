const mongoose = require('mongoose');

// Mongoose configuration options for production stability
const options = {
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 5, // Minimum number of connections
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  family: 4 // Use IPv4, skip trying IPv6
};

async function connectDB(uri) {
  try {
    await mongoose.connect(uri, options);
    console.log("✅ Connected to MongoDB!");
    
    // Connection event handlers for stability
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });
    
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }
}

// Graceful shutdown handler
async function disconnectDB() {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed gracefully');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
    throw error;
  }
}

module.exports = { connectDB, disconnectDB };
