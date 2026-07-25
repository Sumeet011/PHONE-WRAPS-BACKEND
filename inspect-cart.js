const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

async function inspectCart() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const carts = await db.collection('carts').find({}).toArray();

    console.log(`Found ${carts.length} carts\n`);

    carts.forEach((cart, idx) => {
      console.log(`\nCart ${idx + 1} (User: ${cart.userId}):`);
      console.log(`  Items: ${cart.items.length}`);
      
      cart.items.forEach((item, itemIdx) => {
        console.log(`\n  Item ${itemIdx + 1}:`);
        console.log(`    Type: ${item.type}`);
        console.log(`    ProductId: ${item.productId}`);
        console.log(`    Price: ${item.price}`);
        console.log(`    PlatePrice: ${item.platePrice}`);
        console.log(`    PlateQuantity: ${item.plateQuantity}`);
        console.log(`    CollectionType: ${item.collectionType}`);
      });
      console.log('\n' + '='.repeat(60));
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

inspectCart();
