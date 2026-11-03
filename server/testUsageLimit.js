const { getFirestore } = require("firebase-admin/firestore");
require("./firebaseAdmin");

const db = getFirestore();

const testRef = db.collection("system").doc("aiUsageTest");
const TEST_LIMIT = 3;

async function reserveTestRequest() {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(testRef);

    const count = snapshot.exists ? snapshot.data().count : 0;

    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("Invalid test counter");
    }

    if (count >= TEST_LIMIT) {
      return {
        allowed: false,
        remaining: 0,
      };
    }

    transaction.set(testRef, {
      count: count + 1,
      limit: TEST_LIMIT,
    });

    return {
      allowed: true,
      remaining: TEST_LIMIT - count - 1,
    };
  });
}

async function runTest() {
  // Reset only the dedicated test document.
  await testRef.set({ count: 0, limit: TEST_LIMIT });

  // Send four reservation attempts concurrently.
  const results = await Promise.all(
    Array.from({ length: 4 }, () => reserveTestRequest()),
  );

  console.log("Results:", results);

  const snapshot = await testRef.get();
  const finalCount = snapshot.data().count;

  console.log("Final count:", finalCount);

  const allowedCount = results.filter((r) => r.allowed).length;
  const blockedCount = results.filter((r) => !r.allowed).length;

  if (allowedCount === 3 && blockedCount === 1 && finalCount === 3) {
    console.log("PASS: Global transaction limit works");
  } else {
    throw new Error("FAIL: Unexpected transaction results");
  }

  // Remove the temporary test document.
  await testRef.delete();
  console.log("Test document cleaned up");
}

runTest().catch((error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
