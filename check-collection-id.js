const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

async function checkCollection() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Check the productId from the cart
    const targetId = '698ad9d69b2116d9cf5c1faa';
    console.log(`Looking for collection with _id: ${targetId}`);
    console.log(`Is valid ObjectId: ${mongoose.Types.ObjectId.isValid(targetId)}\n`);
    
    // List all collections
    const collections = await db.collection('collections').find({}).toArray();
    console.log(`All collections in database:\n`);
    collections.forEach(col => {
      console.log(`  ${col._id} - ${col.name} (${col.type}) - price: ${col.price}, plateprice: ${col.plateprice}`);
    });
    
    // Try direct lookup
    console.log(`\nDirect lookup of ${targetId}:`);
    const found = await db.collection('collections').findOne({ _id: new mongoose.Types.ObjectId(targetId) });
    console.log(found ? `Found: ${found.name}` : 'Not found');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCollection();
