// Removes the old A to F grade (bsc.grade) from every stored KPI document.
// Outcomes replaced grades (V3 Design A); nothing reads this field and it is
// never sent. Safe to run more than once.
//
//   MONGODB_URI=... node scripts/migrate-remove-bsc-grade.js

const { MongoClient } = require('mongodb');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI.');
    process.exit(1);
  }
  const client = await MongoClient.connect(uri);
  try {
    const res = await client
      .db()
      .collection('kpi_history')
      .updateMany({ 'bsc.grade': { $exists: true } }, { $unset: { 'bsc.grade': '' } });
    console.log(`Removed bsc.grade from ${res.modifiedCount} documents.`);
  } finally {
    await client.close();
  }
})();
