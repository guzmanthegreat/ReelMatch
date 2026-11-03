const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

require("dotenv").config();

const projectId = process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error("FIREBASE_PROJECT_ID is missing");
}

if (!getApps().length) {
  initializeApp({ projectId });
}

const adminAuth = getAuth();

module.exports = { adminAuth };
