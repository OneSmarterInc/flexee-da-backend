import { connect, Connection } from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

async function resetDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flexee';

  try {
    console.log(`🔌 Connecting to MongoDB: ${mongoUri}`);
    const connection: Connection = await connect(mongoUri).then(m => m.connection);

    console.log('🗑️  Resetting database...');
    
    // Get all collections
    if (!connection.db) {
      throw new Error('Database connection is not established');
    }
    const collections = await connection.db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('ℹ️  No collections found to reset');
      await connection.close();
      return;
    }

    console.log(`Found ${collections.length} collections to clear:`);
    
    const deletionPromises = collections.map(async (collection) => {
      try {
        if (!connection.db) {
          throw new Error('Database connection is not established');
        }
        const result = await connection.db.dropCollection(collection.name);
        console.log(`✅ Dropped collection: ${collection.name}`);
        return true;
      } catch (error: any) {
        // Some system collections can't be dropped, skip them
        if (error.codeName !== 'InvalidNamespace') {
          console.warn(`⚠️  Failed to drop ${collection.name}: ${error.message}`);
        }
        return false;
      }
    });

    const results = await Promise.all(deletionPromises);
    const successCount = results.filter(r => r).length;

    console.log(`\n📊 Summary: ${successCount} collections cleared`);
    console.log('✨ Database reset completed!');
    
    await connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database reset failed:', error.message);
    process.exit(1);
  }
}

resetDatabase();
