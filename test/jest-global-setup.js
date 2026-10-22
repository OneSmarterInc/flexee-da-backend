// test/jest-global-setup.js
//
// Gives every test file a MongoDB through MONGO_TEST_URI.
//  - If MONGO_TEST_URI is already set, it is used as is (a throwaway
//    database: tests drop its data).
//  - Otherwise an in-memory server is started with mongodb-memory-server.
//  - If that can't start (for example, its binary download is blocked),
//    MONGO_TEST_URI stays unset and the database suites show as SKIPPED,
//    unless REQUIRE_TEST_DB is set (CI), which makes the run fail instead.
module.exports = async function globalSetup() {
  if (process.env.MONGO_TEST_URI) return;
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    globalThis.__MONGO_TEST_SERVER__ = server;
    process.env.MONGO_TEST_URI = server.getUri('flexee_da_test');
  } catch (err) {
    if (process.env.REQUIRE_TEST_DB) {
      // CI sets REQUIRE_TEST_DB: there, skipping would hide a broken setup.
      throw new Error(
        'REQUIRE_TEST_DB is set but no MongoDB is available for tests: ' +
          String((err && err.message) || err).split('\n')[0],
      );
    }
    console.warn(
      '\n[test db] No MongoDB for tests: ' +
        String((err && err.message) || err).split('\n')[0] +
        '\n[test db] Set MONGO_TEST_URI, or allow the mongodb-memory-server download.' +
        '\n[test db] Database suites are SKIPPED, not passed.\n',
    );
  }
};
