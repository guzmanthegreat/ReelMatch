// ReelMatch backend
//
// This file does four jobs:
// 1. Serves the React build.
// 2. Talks to TMDB without exposing the TMDB token to the browser.
// 3. Uses OpenAI to rank verified movie candidates.
// 4. Streams match explanations back to the React app.

const express = require("express");
const path = require("node:path");
require("dotenv").config();
const OpenAI = require("openai");

const app = express();

// Render sits in front of this server as a proxy. This setting lets Express
// read the real visitor IP for the simple in-memory request limiter below.
app.disable("x-powered-by");
app.set("trust proxy", 1);

// Reject very large request bodies before they reach our route handlers.
app.use(express.json({ limit: "32kb" }));

// -----------------------------
// Configuration
// -----------------------------

const PORT = Number(process.env.PORT) || 3001;
const TMDB_TOKEN = process.env.TMDB_TOKEN || process.env.TMDB_READ_ACCESS_TOKEN;
const AI_ENABLED = process.env.ENABLE_PUBLIC_AI === "true";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// These limits are a basic safety net for the demo. They reset when the
// server restarts, so a larger production app should use Redis later.
const AI_WINDOW_MS = 60 * 60 * 1000;
const AI_PER_IP_LIMIT = Number(process.env.AI_PER_IP_LIMIT) || 20;
const AI_GLOBAL_LIMIT = Number(process.env.AI_GLOBAL_LIMIT) || 500;
const requestsByIp = new Map();
let allAiRequests = [];

// OpenAI is optional while developing the non-AI parts of the app. The app
// gives a clear 503 error instead of crashing if the key is missing.
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 25000,
      maxRetries: 0,
    })
  : null;

// These are the only match labels the frontend expects.
const MATCH_CATEGORIES = [
  "Perfect Match",
  "Highly Likely",
  "Worth a Watch",
  "Unlikely Match",
  "Not for You",
];

// -----------------------------
// Small reusable helpers
// -----------------------------

function cleanText(value, maxLength = 150) {
  // User input and API text should have a maximum size before entering a
  // prompt or being returned to the browser.
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function isValidTitle(title) {
  return (
    title &&
    ["movie", "tv"].includes(title.type) &&
    Number.isSafeInteger(title.id) &&
    title.id > 0
  );
}

function itemKey(item) {
  // The same TMDB number can exist for a movie and a TV show, so include type.
  return `${item.type}:${item.id}`;
}

function normalizedTitle(item) {
  return (item.title || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function sendError(res, error, label) {
  // Detailed errors are useful in Render logs, but users only need a safe,
  // readable message explaining which service failed.
  console.error(`[ReelMatch] ${label}:`, error.status || "", error.message);
  const status = error.status || 502;
  const message = status === 503 ? error.message : `${label} temporarily unavailable.`;
  return res.status(status).json({ error: message });
}

function tmdbMovie(raw, type = raw.media_type) {
  // TMDB calls movies `title` and TV shows `name`. Convert both to `title`
  // so the React app only needs one data shape.
  return {
    id: raw.id,
    type,
    title: raw.title || raw.name || "",
    year: (raw.release_date || raw.first_air_date || "").slice(0, 4),
    releaseDate: raw.release_date || raw.first_air_date || "",
    poster: raw.poster_path
      ? `https://image.tmdb.org/t/p/w342${raw.poster_path}`
      : null,
    overview: cleanText(raw.overview, 450),
    popularity: raw.popularity || 0,
    voteCount: raw.vote_count || 0,
    rating: raw.vote_average || 0,
  };
}

function validateTaste(body) {
  // The browser is untrusted input. Keep only the fields the backend needs.
  const favorites = body?.favorites;
  if (
    !Array.isArray(favorites) ||
    favorites.length < 1 ||
    favorites.length > 30 ||
    !favorites.every(isValidTitle)
  ) {
    return null;
  }

  const feedback = Array.isArray(body.feedback)
    ? body.feedback
        .slice(0, 150)
        .filter(
          (item) =>
            isValidTitle(item) &&
            ["love", "watch", "seen", "no"].includes(item.value),
        )
    : [];

  const preferences =
    body.preferences && typeof body.preferences === "object"
      ? body.preferences
      : {};

  return {
    favorites,
    feedback,
    preferences: {
      mood: cleanText(preferences.mood),
      pace: cleanText(preferences.pace),
      format: cleanText(preferences.format),
    },
  };
}

// -----------------------------
// External service helpers
// -----------------------------

async function tmdb(route, params = {}) {
  // The browser never sees TMDB_TOKEN. It only calls our own /api routes.
  if (!TMDB_TOKEN) {
    const error = new Error("TMDB is not configured");
    error.status = 503;
    throw error;
  }

  const url = new URL(`https://api.themoviedb.org/3/${route}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const error = new Error("TMDB request failed");
    error.status = 502;
    throw error;
  }

  return response.json();
}

async function askOpenAI(prompt, schema, schemaName, maxOutputTokens = 5000) {
  // Structured JSON output is easier to validate than free-form text.
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });

  if (!response.output_text) throw new Error("AI returned no text");
  return JSON.parse(response.output_text);
}

// -----------------------------
// AI request limiter
// -----------------------------

function allowAiRequest(ip) {
  // Remove timestamps older than one hour from both counters.
  const now = Date.now();
  const windowStart = now - AI_WINDOW_MS;
  const ipRequests = (requestsByIp.get(ip) || []).filter(
    (timestamp) => timestamp > windowStart,
  );
  allAiRequests = allAiRequests.filter(
    (timestamp) => timestamp > windowStart,
  );

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

// -----------------------------
// TMDB routes
// -----------------------------

app.get("/api/health", (req, res) => {
  // Render uses this route to decide whether the service is healthy.
  res.json({
    ok: true,
    service: "ReelMatch",
    tmdbConfigured: Boolean(TMDB_TOKEN),
    aiEnabled: AI_ENABLED,
  });
});

app.get("/api/search", async (req, res) => {
  // Search results are ranked so exact title matches appear first.
  const query = cleanText(req.query.query || req.query.q, 100).trim();
  if (query.length < 2) {
    return res.status(400).json({ error: "Enter at least two characters." });
  }

  try {
    const normalize = (value) =>
      String(value || "")
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
    const normalizedQuery = normalize(query);
    const raw = await tmdb("search/multi", {
      query,
      include_adult: "false",
      language: "en-US",
      page: 1,
    });

    const results = (raw.results || [])
      .filter(
        (item) =>
          ["movie", "tv"].includes(item.media_type) && item.poster_path,
      )
      .sort((a, b) => {
        const score = (item) => {
          const names = [
            item.title,
            item.name,
            item.original_title,
            item.original_name,
          ].map(normalize);
          if (names.includes(normalizedQuery)) return 0;
          if (names.some((name) => name.startsWith(normalizedQuery))) return 1;
          return 2;
        };
        return score(a) - score(b) || (b.popularity || 0) - (a.popularity || 0);
      })
      .map((item) => tmdbMovie(item, item.media_type))
      .filter((item, index, all) => {
        return (
          item.title &&
          all.findIndex((other) => itemKey(other) === itemKey(item)) === index
        );
      })
      .slice(0, 24);

    res.json(results);
  } catch (error) {
    sendError(res, error, "Search");
  }
});

const discoveryRows = [
  // Each entry becomes one horizontal collection on the onboarding page.
  ["Popular Movies", "movie", {}],
  ["Popular TV Shows", "tv", {}],
  ["Action & Adventure", "movie", { with_genres: "28,12" }],
  ["Comedy", "movie", { with_genres: "35" }],
  ["Drama", "movie", { with_genres: "18" }],
  ["Science Fiction", "movie", { with_genres: "878" }],
  ["Horror & Thriller", "movie", { with_genres: "27,53" }],
  ["Romance", "movie", { with_genres: "10749" }],
  ["Animation & Family", "movie", { with_genres: "16,10751" }],
  [
    "Critically Loved TV",
    "tv",
    { sort_by: "vote_average.desc", "vote_count.gte": "250" },
  ],
];

app.get("/api/discovery", async (req, res) => {
  try {
    // Promise.all loads every row at the same time, making onboarding faster.
    const rows = await Promise.all(
      discoveryRows.map(async ([title, type, filters]) => {
        const raw = await tmdb(`discover/${type}`, {
          ...filters,
          language: "en-US",
          include_adult: "false",
          sort_by: filters.sort_by || "popularity.desc",
        });
        return {
          title,
          items: (raw.results || [])
            .filter((item) => item.poster_path)
            .slice(0, 12)
            .map((item) => tmdbMovie(item, type)),
        };
      }),
    );
    res.json({ rows });
  } catch (error) {
    sendError(res, error, "Discovery collections");
  }
});

// -----------------------------
// Recommendation route
// -----------------------------

async function getCandidates(taste, page = 1) {
  // Ask TMDB for similar titles first. OpenAI only ranks these real titles.
  const favorites = taste.favorites.slice(0, 6);
  const pages = Math.max(1, Math.min(3, Number(page) || 1));
  const responses = await Promise.all(
    favorites.flatMap((favorite) =>
      [pages, pages + 1].map(async (sourcePage) => {
        try {
          return await tmdb(`${favorite.type}/${favorite.id}/recommendations`, {
            page: sourcePage,
            language: "en-US",
          });
        } catch {
          // One unavailable favorite should not prevent all other favorites
          // from producing recommendations.
          return { results: [] };
        }
      }),
    ),
  );

  const excluded = new Set(taste.favorites.map(itemKey));
  taste.feedback
    .filter((item) => ["seen", "no", "love"].includes(item.value))
    .forEach((item) => excluded.add(itemKey(item)));

  const candidatesByTitle = new Map();
  responses.forEach((response, responseIndex) => {
    const source = favorites[Math.floor(responseIndex / 2)];
    for (const raw of response.results || []) {
      const candidate = tmdbMovie(raw, source.type);
      const title = normalizedTitle(candidate);
      if (
        candidate.poster &&
        candidate.title &&
        !excluded.has(itemKey(candidate)) &&
        title &&
        !candidatesByTitle.has(title)
      ) {
        candidatesByTitle.set(title, candidate);
      }
    }
  });

  return [...candidatesByTitle.values()]
    .sort(
      (a, b) =>
        b.rating * Math.log1p(b.voteCount) -
        a.rating * Math.log1p(a.voteCount),
    )
    .slice(0, 100);
}

app.post("/api/recommend", requireAI, async (req, res) => {
  const taste = validateTaste(req.body);
  if (!taste) {
    return res
      .status(400)
      .json({ error: "Choose at least one valid favorite." });
  }

  try {
    const history = new Set(
      Array.isArray(req.body.exclude)
        ? req.body.exclude
            .filter((value) => typeof value === "string")
            .slice(-250)
        : [],
    );
    const candidates = await getCandidates(taste, req.body.page);
    const fresh = candidates.filter((item) => !history.has(itemKey(item)));
    const pool = (fresh.length ? fresh : candidates).slice(0, 100);
    if (!pool.length) return res.json({ results: [] });

    const rowNames = [
      "Best Matches",
      "More Like Your Favorites",
      "Hidden Gems",
      "Big Screen Energy",
      "Easy Watching",
      "Smart & Thought-Provoking",
      "High-Intensity Picks",
      "Feel-Good Picks",
      "Worth Exploring",
      "Wild Cards",
    ];

    const prompt = `You are ReelMatch, a playful but accurate spoiler-free film advisor. Rank verified candidate IDs only. Use favorites as strong positive signals; Loved It as positive; Not for Me as negative; Want to Watch as interest only; Already Seen as neutral. Preferences are optional. Do not invent facts. Organize candidates across exactly these rows: ${JSON.stringify(rowNames)}. Each row should contain 5 to 8 different candidate IDs when possible. Every candidate ID may appear only once across the entire response. Return only the category for each pick; do not write explanations here because explanations are generated on the match-details screen.\nTaste: ${JSON.stringify(taste)}\nCandidates: ${JSON.stringify(pool.map((item) => ({ id: itemKey(item), title: item.title, overview: item.overview, year: item.year, rating: item.rating })))} `;

    const result = await askOpenAI(
      prompt,
      {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                picks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      category: {
                        type: "string",
                        enum: MATCH_CATEGORIES,
                      },
                    },
                    required: ["id", "category"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "picks"],
              additionalProperties: false,
            },
          },
        },
        required: ["rows"],
        additionalProperties: false,
      },
      "reelmatch_recommendations",
      3000,
    );

    // Never trust an ID just because the model returned it. Only titles in
    // the verified pool are allowed into the response.
    const poolById = new Map(pool.map((item) => [itemKey(item), item]));
    const used = new Set();
    const rows = (result.rows || [])
      .slice(0, 10)
      .map((row, rowIndex) => ({
        title: cleanText(row.title, 60) || rowNames[rowIndex],
        items: (row.picks || [])
          .map((pick) => {
            if (!poolById.has(pick.id) || used.has(pick.id)) return null;
            used.add(pick.id);
            return {
              ...poolById.get(pick.id),
              category: pick.category,
              reason: "",
            };
          })
          .filter(Boolean)
          .slice(0, 10),
      }))
      .filter((row) => row.items.length);

    return res.json({ rows });
  } catch (error) {
    return sendError(res, error, "Recommendations");
  }
});

// -----------------------------
// Streaming match explanation
// -----------------------------

function sendSse(res, eventName, data) {
  // Server-Sent Events use a simple text format: event name, JSON data, blank
  // line. The frontend reads these events as the AI response arrives.
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}

function buildMatchPrompt(taste, title) {
  return `You are ReelMatch, a charismatic Gen Z movie friend and influencer who is trying to get the user genuinely excited to watch a title. Be energetic, personal, persuasive, and natural—like a friend sending a voice note—not like an AI, critic, or corporate review. Your response must have exactly two parts: first, one line containing only one of these exact categories: ${MATCH_CATEGORIES.join(", ")}. Then, on the next line, write a short 2-3 sentence message. Start with an attention-grabbing hook such as "heyyy", "okayyy", "wait", or "listen". Connect the movie to the user's favorites, feedback, or preferences when relevant, explain the specific vibe they will get, and finish with a confident call to action such as "trust me, press play" or "add this immediately". Use 0-2 emojis naturally when they improve the tone, but do not overdo slang or emojis. Stay spoiler-free, honest, and specific. Use only the provided TMDB details and user taste. Never invent plot points or claim the user watched something they did not provide.\nTaste: ${JSON.stringify(taste)}\nTitle: ${JSON.stringify(title)}`;
}

app.post("/api/match/stream", requireAI, async (req, res) => {
  const taste = validateTaste(req.body);
  const requestedTitle = req.body?.title;
  if (!taste || !isValidTitle(requestedTitle)) {
    return res
      .status(400)
      .json({ error: "Select a title and at least one favorite." });
  }

  // Tell browsers and proxies not to buffer the response. Otherwise the user
  // would see the entire explanation at once instead of word by word.
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  try {
    const raw = await tmdb(`${requestedTitle.type}/${requestedTitle.id}`);
    const title = tmdbMovie(raw, requestedTitle.type);
    const stream = await openai.responses.create({
      model: OPENAI_MODEL,
      input: buildMatchPrompt(taste, title),
      max_output_tokens: 700,
      stream: true,
    });

    let header = "";
    let pendingWords = "";
    let categorySent = false;

    // Send complete words where possible so the frontend's typing animation
    // feels natural instead of receiving random character-sized chunks.
    const sendWords = (text) => {
      pendingWords += text;
      const words = pendingWords.split(/(?<=\s)/);
      pendingWords = words.pop() || "";
      words.forEach((word) => sendSse(res, "delta", { text: word }));
    };

    for await (const event of stream) {
      if (event.type !== "response.output_text.delta") continue;
      const text = event.delta || "";

      if (!categorySent) {
        header += text;
        const newline = header.search(/\r?\n/);
        if (newline === -1) continue;

        const categoryText = header.slice(0, newline).trim().toLowerCase();
        const category =
          MATCH_CATEGORIES.find((item) => item.toLowerCase() === categoryText) ||
          "Worth a Watch";
        sendSse(res, "category", { category });
        categorySent = true;
        sendWords(header.slice(newline + (header[newline] === "\r" ? 2 : 1)));
      } else {
        sendWords(text);
      }
    }

    // If the model forgot the category line, still send a safe fallback.
    if (!categorySent) {
      const fallback = header.trim();
      sendSse(res, "category", { category: "Worth a Watch" });
      sendWords(fallback);
    }
    if (pendingWords) sendSse(res, "delta", { text: pendingWords });
    sendSse(res, "done", { title });
    res.end();
  } catch (error) {
    console.error("[ReelMatch] Match analysis stream:", error.message);
    sendSse(res, "error", {
      error:
        error.status === 503
          ? error.message
          : "Match analysis temporarily unavailable.",
    });
    res.end();
  }
});

// -----------------------------
// Static frontend and startup
// -----------------------------

const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));

// Return JSON for unknown API routes, but let React handle browser routes.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ReelMatch API running on port ${PORT}`);
  });
}

// Export helpers so the lightweight Node test file can test validation
// without needing to start a real network server.
module.exports = app;
module.exports.validateTaste = validateTaste;
module.exports.cleanText = cleanText;
module.exports.categories = MATCH_CATEGORIES;
