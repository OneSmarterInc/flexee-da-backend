// test/mongo-test-db.ts
//
// Database helpers for tests. jest-global-setup.js puts a MongoDB URI in
// MONGO_TEST_URI, or leaves it unset when no MongoDB is available. Use
// `describeDb` for suites that need the database, so they show as skipped
// (never as passed) when there is none.

import mongoose, { Connection } from 'mongoose';

export const hasTestDb = !!process.env.MONGO_TEST_URI;

export const describeDb: jest.Describe = hasTestDb
  ? describe
  : (describe.skip as unknown as jest.Describe);

/**
 * Connect to a database of this test file's own. Jest runs test files in
 * parallel, and each file empties its database between tests, so files
 * must never share one.
 */
export async function connectTestDb(): Promise<Connection> {
  const base = new URL(process.env.MONGO_TEST_URI!);
  const stem = base.pathname.replace(/^\//, '') || 'flexee_da_test';
  const suffix = `${process.env.JEST_WORKER_ID ?? '0'}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  // MongoDB database names are limited to 63 bytes.
  base.pathname = `/${`${stem}_${suffix}`.slice(0, 63)}`;
  return mongoose.createConnection(base.toString()).asPromise();
}

/** Drop this file's database and close the connection. */
export async function closeTestDb(conn: Connection): Promise<void> {
  await conn.dropDatabase();
  await conn.close();
}

export async function clearTestDb(conn: Connection): Promise<void> {
  const collections = await conn.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
