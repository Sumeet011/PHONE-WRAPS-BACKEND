const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

async function fixCartPrices() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Cart = require('./Models/Cart/Cart.model');
    const Collection = require('./Models/Collection/Collection.model');
    const Product = require('./Models/Products/Product.model');

    const carts = await Cart.find({});
    console.log(`Found ${carts.length} carts to check\n`);

    let totalFixed = 0;
    let totalItems = 0;

    for (const cart of carts) {
      let cartModified = false;

      for (let i = 0; i < cart.items.length; i++) {
        const item = cart.items[i];
        totalItems++;

        // Only fix collection items with 0 or missing platePrice that have plates
        if (item.type === 'collection' && (!item.platePrice || item.platePrice === 0) && item.plateQuantity && item.plateQuantity > 0) {
          try {
            // Fetch the collection to get the correct plateprice
            let collection = await Collection.findById(item.productId).lean();
            
            // If not found by ID, try to find by collectionName if available
            if (!collection && item.collectionName) {
              console.log(`⚠️  Collection not found by ID, trying by name: ${item.collectionName}`);
              collection = await Collection.findOne({ name: item.collectionName }).lean();
              
              if (collection) {
                console.log(`✅ Found collection by name, updating productId too`);
                cart.items[i].productId = collection._id;
              }
            }
            
            if (collection && collection.plateprice && collection.plateprice > 0) {
              console.log(`Fixing item in cart ${cart.userId}:`);
              console.log(`  Collection: ${collection.name}`);
              console.log(`  Old platePrice: ${item.platePrice}`);
              console.log(`  New platePrice: ${collection.plateprice}`);
              console.log(`  Plate quantity: ${item.plateQuantity}`);
              
              // Update the platePrice
              cart.items[i].platePrice = collection.plateprice;
              cartModified = true;
              totalFixed++;
            } else if (collection) {
              console.log(`⚠️  Collection ${collection.name} has no plateprice set`);
            } else {
              console.log(`⚠️  Collection not found for productId: ${item.productId}`);
              console.log(`     CollectionName in cart: ${item.collectionName || 'not set'}`);
              console.log(`     → User should remove this item and re-add it`);
            }
          } catch (error) {
            console.error(`Error fixing item ${item._id}:`, error.message);
          }
        }
      }

      if (cartModified) {
        await cart.save();
        console.log(`✅ Cart updated\n`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Total carts checked: ${carts.length}`);
    console.log(`  Total cart items: ${totalItems}`);
    console.log(`  Items fixed: ${totalFixed}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCartPrices();
