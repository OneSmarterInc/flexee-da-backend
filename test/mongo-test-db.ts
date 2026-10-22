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

export async function connectTestDb(): Promise<Connection> {
  return mongoose.createConnection(process.env.MONGO_TEST_URI!).asPromise();
}

export async function clearTestDb(conn: Connection): Promise<void> {
  const collections = await conn.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
