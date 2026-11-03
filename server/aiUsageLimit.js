const { getFirestore } = require("firebase-admin/firestore");
require("./firebaseAdmin");

const db = getFirestore();

// Maximum reservations across the entire application.
const MAX_AI_REQUESTS = 100;

const counterRef = db.collection("system").doc("aiUsage");

async function reserveAIRequest() {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);

    const currentCount = snapshot.exists ? snapshot.data().count : 0;

    // Fail closed if the stored counter is invalid.
    if (!Number.isSafeInteger(currentCount) || currentCount < 0) {
      throw new Error("Invalid AI usage counter");
    }

    if (currentCount >= MAX_AI_REQUESTS) {
      return {
        allowed: false,
        remaining: 0,
      };
    }

    const nextCount = currentCount + 1;

    transaction.set(counterRef, {
      count: nextCount,
      limit: MAX_AI_REQUESTS,
      updatedAt: new Date().toISOString(),
    });

    return {
      allowed: true,
      remaining: MAX_AI_REQUESTS - nextCount,
    };
  });
}

module.exports = { reserveAIRequest };
