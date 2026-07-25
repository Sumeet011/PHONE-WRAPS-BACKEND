const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

async function testCollectionAPI() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Collection = require('./Models/Collection/Collection.model');
    const Product = require('./Models/Products/Product.model');
    
    // Fetch Spider Man collection without populate first
    const collection = await Collection.findOne({ name: 'Spider Man' }).lean();
    
    console.log('Spider Man Collection Data:\n');
    console.log('Name:', collection.name);
    console.log('Type:', collection.type);
    console.log('Price:', collection.price);
    console.log('Plateprice:', collection.plateprice);
    console.log('Price type:', typeof collection.price);
    console.log('Plateprice type:', typeof collection.plateprice);
    console.log('\nRelevant fields:');
    console.log(JSON.stringify({
      name: collection.name,
      type: collection.type,
      price: collection.price,
      plateprice: collection.plateprice,
      heroImage: collection.heroImage
    }, null, 2));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testCollectionAPI();
