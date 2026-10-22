/* eslint-disable no-console */
// V3 F1: courses deployed to students before the fix stayed INITIALIZED, so
// their quarters never closed on their own. This marks each one IN_PROGRESS.
//
// Dry run by default: it lists the courses and their current deadline and
// changes nothing. Run with --apply to change them. Safe to run again.
//
// A course whose deadline has already passed closes at the next sweep once
// it is IN_PROGRESS. To give students more time instead, extend that quarter
// in the faculty page first, then run with --apply.

const mongoose = require('mongoose');

async function main() {
  const apply = process.argv.includes('--apply');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flexee';
  console.log(`[migrate-start-deployed-courses] ${apply ? 'APPLY' : 'DRY RUN'}. Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);

  const simulations = mongoose.connection.collection('simulations');
  const stuck = await simulations
    .find({ status: 'INITIALIZED', deploymentStatus: 'STUDENT_DEPLOYED' })
    .project({ name: 1, currentQuarter: 1, quarterEndsAt: 1, timezone: 1 })
    .toArray();

  for (const s of stuck) {
    const due = s.quarterEndsAt ? new Date(s.quarterEndsAt).toISOString() : 'none';
    const past = s.quarterEndsAt && new Date(s.quarterEndsAt) < new Date() ? ' (already passed)' : '';
    console.log(`  ${s._id}  "${s.name}"  Q${s.currentQuarter}  deadline ${due} UTC${past}  zone ${s.timezone || 'UTC'}`);
  }
  console.log(`[migrate-start-deployed-courses] ${stuck.length} course(s) deployed to students but still INITIALIZED.`);

  if (apply && stuck.length > 0) {
    const result = await simulations.updateMany(
      { _id: { $in: stuck.map((s) => s._id) }, status: 'INITIALIZED' },
      { $set: { status: 'IN_PROGRESS' } },
    );
    console.log(`[migrate-start-deployed-courses] Marked ${result.modifiedCount} course(s) IN_PROGRESS.`);
  } else if (!apply) {
    console.log('[migrate-start-deployed-courses] Nothing changed. Run with --apply to change them.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[migrate-start-deployed-courses] Failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
