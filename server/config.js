const OpenAI = require("openai");

// Read server settings and API credentials from Render or the local environment.
let PORT = Number(process.env.PORT);
if (!PORT) {
  PORT = 3001;
}

let TMDB_TOKEN = process.env.TMDB_TOKEN;
if (!TMDB_TOKEN) {
  TMDB_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
}
const AI_ENABLED = process.env.ENABLE_PUBLIC_AI === "true";
let OPENAI_MODEL = process.env.OPENAI_MODEL;
if (!OPENAI_MODEL) {
  OPENAI_MODEL = "gpt-4o-mini";
}

// These limits are a basic safety net for the demo. They reset when the
// server restarts, so a larger production app should use Redis later.
const AI_WINDOW_MS = 60 * 60 * 1000;
let AI_PER_IP_LIMIT = Number(process.env.AI_PER_IP_LIMIT);
if (!AI_PER_IP_LIMIT) {
  AI_PER_IP_LIMIT = 20;
}

let AI_GLOBAL_LIMIT = Number(process.env.AI_GLOBAL_LIMIT);
if (!AI_GLOBAL_LIMIT) {
  AI_GLOBAL_LIMIT = 500;
}

// OpenAI is optional while developing the non-AI parts of the app. The app
// gives a clear 503 error instead of crashing if the key is missing.
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 25000,
    maxRetries: 0,
  });
}

module.exports = {
  PORT,
  TMDB_TOKEN,
  AI_ENABLED,
  OPENAI_MODEL,
  AI_WINDOW_MS,
  AI_PER_IP_LIMIT,
  AI_GLOBAL_LIMIT,
  openai,
};

