module.exports = async function globalTeardown() {
  if (globalThis.__MONGO_TEST_SERVER__)
    await globalThis.__MONGO_TEST_SERVER__.stop();
};
