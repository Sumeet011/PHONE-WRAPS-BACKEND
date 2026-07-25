const mongoose = require('mongoose');
require('dotenv').config({ path: './Src/.env' });

const dropOldIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.db.collection('phonebrands');
        
        // Get all indexes
        const indexes = await collection.indexes();
        console.log('\nCurrent indexes:');
        indexes.forEach(index => {
            console.log('-', JSON.stringify(index.key), index.name);
        });

        // Drop old brandCode index if it exists
        try {
            await collection.dropIndex('brandCode_1');
            console.log('\n✓ Dropped old brandCode_1 index');
        } catch (err) {
            console.log('\n- No brandCode_1 index to drop');
        }

        // Drop old modelCode index if it exists
        try {
            await collection.dropIndex('models.modelCode_1');
            console.log('✓ Dropped old models.modelCode_1 index');
        } catch (err) {
            console.log('- No models.modelCode_1 index to drop');
        }

        console.log('\n✓ Index cleanup complete!');
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

dropOldIndexes();
