/**
 * Migration: Migrate 'password' field to 'passwordHash' and set default isActive
 *
 * This script migrates legacy user records that have a 'password' field instead of
 * 'passwordHash'. It:
 * 1. Copies the 'password' value to 'passwordHash'
 * 2. Ensures 'isActive' is set (defaults to true if missing)
 * 3. Removes the old 'password' field
 *
 * Usage:
 *   node scripts/migrate-password-to-passwordHash.js
 *
 * Or with MongoDB shell:
 *   mongosh <your-connection-string>
 *   db.users.updateMany(
 *     { passwordHash: { $exists: false }, password: { $exists: true } },
 *     [
 *       { $set: { passwordHash: "$password", isActive: { $ifNull: ["$isActive", true] } } },
 *       { $unset: "password" }
 *     ]
 *   );
 */

const mongoose = require('mongoose');

async function runMigration() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://priyanshupj13:0pU6rPXsRpC9YDJ5@gymdb.vot7fyq.mongodb.net/flexee2da';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get the users collection directly
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Run the aggregation pipeline update
    const result = await usersCollection.updateMany(
      { passwordHash: { $exists: false }, password: { $exists: true } },
      [
        { $set: { passwordHash: '$password', isActive: { $ifNull: ['$isActive', true] } } },
        { $unset: 'password' }
      ]
    );

    console.log(`Migration completed:`);
    console.log(`  Matched documents: ${result.matchedCount}`);
    console.log(`  Modified documents: ${result.modifiedCount}`);

    if (result.modifiedCount > 0) {
      console.log(`✓ Successfully migrated ${result.modifiedCount} user(s)`);
    } else {
      console.log('ℹ No users needed migration (all have passwordHash or none have password field)');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
