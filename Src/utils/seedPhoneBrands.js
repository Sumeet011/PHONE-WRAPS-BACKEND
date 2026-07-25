/**
 * Phone Brand Seed Script
 * 
 * This script helps you populate the database with initial phone brands and models.
 * Run this script once after setting up the database.
 * 
 * Usage:
 * 1. Make sure your MongoDB connection is working
 * 2. Run: node BACKEND/Src/utils/seedPhoneBrands.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const PhoneBrand = require('../../Models/PhoneBrand/PhoneBrand.model');

const seedBrands = [
  {
    brandName: 'Apple',
    models: [
      { modelName: 'iPhone 16 Pro Max' },
      { modelName: 'iPhone 16 Pro' },
      { modelName: 'iPhone 16 Plus' },
      { modelName: 'iPhone 16' },
      { modelName: 'iPhone 15 Pro Max' },
      { modelName: 'iPhone 15 Pro' },
      { modelName: 'iPhone 15 Plus' },
      { modelName: 'iPhone 15' },
      { modelName: 'iPhone 14 Pro Max' },
      { modelName: 'iPhone 14 Pro' },
      { modelName: 'iPhone 14 Plus' },
      { modelName: 'iPhone 14' },
      { modelName: 'iPhone 13 Pro Max' },
      { modelName: 'iPhone 13 Pro' },
      { modelName: 'iPhone 13' },
      { modelName: 'iPhone 13 Mini' },
      { modelName: 'iPhone 12 Pro Max' },
      { modelName: 'iPhone 12 Pro' },
      { modelName: 'iPhone 12' },
      { modelName: 'iPhone 12 Mini' },
    ],
    isActive: true
  },
  {
    brandName: 'Samsung',
    models: [
      { modelName: 'Galaxy S24 Ultra' },
      { modelName: 'Galaxy S24+' },
      { modelName: 'Galaxy S24' },
      { modelName: 'Galaxy S23 Ultra' },
      { modelName: 'Galaxy S23+' },
      { modelName: 'Galaxy S23' },
      { modelName: 'Galaxy S22 Ultra' },
      { modelName: 'Galaxy S22+' },
      { modelName: 'Galaxy S22' },
      { modelName: 'Galaxy Z Fold 5' },
      { modelName: 'Galaxy Z Flip 5' },
      { modelName: 'Galaxy A54' },
      { modelName: 'Galaxy A34' },
      { modelName: 'Galaxy A14' },
    ],
    isActive: true
  },
  {
    brandName: 'Google',
    models: [
      { modelName: 'Pixel 8 Pro' },
      { modelName: 'Pixel 8' },
      { modelName: 'Pixel 7 Pro' },
      { modelName: 'Pixel 7' },
      { modelName: 'Pixel 7a' },
      { modelName: 'Pixel 6 Pro' },
      { modelName: 'Pixel 6' },
      { modelName: 'Pixel 6a' },
    ],
    isActive: true
  },
  {
    brandName: 'OnePlus',
    models: [
      { modelName: 'OnePlus 12' },
      { modelName: 'OnePlus 12R' },
      { modelName: 'OnePlus 11' },
      { modelName: 'OnePlus 11R' },
      { modelName: 'OnePlus 10 Pro' },
      { modelName: 'OnePlus 10T' },
      { modelName: 'OnePlus Nord 3' },
      { modelName: 'OnePlus Nord CE 3' },
    ],
    isActive: true
  },
  {
    brandName: 'Xiaomi',
    models: [
      { modelName: 'Xiaomi 14 Pro' },
      { modelName: 'Xiaomi 14' },
      { modelName: 'Xiaomi 13 Pro' },
      { modelName: 'Xiaomi 13' },
      { modelName: 'Xiaomi 12 Pro' },
      { modelName: 'Xiaomi 12' },
      { modelName: 'Redmi Note 13 Pro+' },
      { modelName: 'Redmi Note 13 Pro' },
      { modelName: 'Redmi Note 13' },
      { modelName: 'Redmi Note 12 Pro' },
      { modelName: 'Redmi Note 12' },
    ],
    isActive: true
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing phone brands (optional - comment out if you want to keep existing data)
    await PhoneBrand.deleteMany({});
    console.log('🧹 Cleared existing phone brands');

    // Insert seed data
    const result = await PhoneBrand.insertMany(seedBrands);
    console.log(`✅ Successfully seeded ${result.length} phone brands with their models`);

    // Display summary
    result.forEach(brand => {
      console.log(`   📱 ${brand.brandName}: ${brand.models.length} models`);
    });

    console.log('\n✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
  }
}

// Run the seed function
seedDatabase();
