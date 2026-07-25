const mongoose = require('mongoose');
require('dotenv').config({ path: './Src/.env' });

const clearAllCartCoupons = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.db.collection('carts');
        
        // Update all carts to remove applied coupons
        const result = await collection.updateMany(
            {},
            { $set: { appliedCoupons: [] } }
        );

        console.log(`\n✓ Cleared coupons from ${result.modifiedCount} carts`);
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

clearAllCartCoupons();
