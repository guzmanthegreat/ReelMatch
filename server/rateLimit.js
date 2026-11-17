const config = require("./config");
const AI_ENABLED = config.AI_ENABLED;
const AI_WINDOW_MS = config.AI_WINDOW_MS;
const AI_PER_IP_LIMIT = config.AI_PER_IP_LIMIT;
const AI_GLOBAL_LIMIT = config.AI_GLOBAL_LIMIT;
const openai = config.openai;

// This simple limiter is intentionally kept in one file. It resets when the
// server restarts; use a shared store later if the app needs to scale.
const requestsByIp = new Map();
let allAiRequests = [];

// Allows a request only when both the per-IP and total limits have room.
function allowAiRequest(ip) {
  // Remove timestamps older than one hour from both counters.
  const now = Date.now();
  const windowStart = now - AI_WINDOW_MS;
  let savedIpRequests = requestsByIp.get(ip);
  if (!savedIpRequests) {
    savedIpRequests = [];
  }

  const ipRequests = [];
  for (let index = 0; index < savedIpRequests.length; index += 1) {
    const timestamp = savedIpRequests[index];
    if (timestamp > windowStart) {
      ipRequests.push(timestamp);
    }
  }

  const recentRequests = [];
  for (let index = 0; index < allAiRequests.length; index += 1) {
    const timestamp = allAiRequests[index];
    if (timestamp > windowStart) {
      recentRequests.push(timestamp);
    }
  }
  allAiRequests = recentRequests;

  // Check both limits before recording the new request.
  if (
    ipRequests.length >= AI_PER_IP_LIMIT ||
    allAiRequests.length >= AI_GLOBAL_LIMIT
  ) {
    return false;
  }

  ipRequests.push(now);
  allAiRequests.push(now);
  requestsByIp.set(ip, ipRequests);
  return true;
}

// Blocks AI routes when AI is off, unconfigured, or over its request limit.
function requireAI(req, res, next) {
  // This middleware runs before the expensive OpenAI routes.
  if (!AI_ENABLED) {
    return res.status(503).json({
      error: "AI features are temporarily disabled for public visitors.",
    });
  }

  if (!openai) {
    return res.status(503).json({ error: "AI is not configured." });
  }

  if (!allowAiRequest(req.ip)) {
    return res.status(429).json({
      error: "AI request limit reached. Please try again later.",
    });
  }

  next();
}


module.exports = { requireAI };

