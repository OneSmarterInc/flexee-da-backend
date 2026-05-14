/* eslint-disable no-console */
const mongoose = require('mongoose');

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flexee';
  console.log('[migrate-maxQuarters-to-totalQuarters] Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const simulations = mongoose.connection.collection('simulations');
  const cursor = simulations.find({ maxQuarters: { $exists: true } });

  let scanned = 0;
  let copied = 0;
  let removed = 0;

  for await (const simulation of cursor) {
    scanned += 1;
    const update = {};
    if (simulation.totalQuarters === undefined || simulation.totalQuarters === null) {
      update.$set = { totalQuarters: simulation.maxQuarters };
      copied += 1;
    }
    update.$unset = { maxQuarters: '' };

    const result = await simulations.updateOne({ _id: simulation._id }, update);
    if (result.modifiedCount > 0) {
      removed += 1;
    }
  }

  console.log(`[migrate-maxQuarters-to-totalQuarters] Scanned ${scanned} simulation document(s).`);
  console.log(`[migrate-maxQuarters-to-totalQuarters] Copied maxQuarters to totalQuarters for ${copied} document(s).`);
  console.log(`[migrate-maxQuarters-to-totalQuarters] Removed maxQuarters from ${removed} document(s).`);
  console.log('[migrate-maxQuarters-to-totalQuarters] Complete. Safe to run again.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[migrate-maxQuarters-to-totalQuarters] Failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exitCode = 1;
});
