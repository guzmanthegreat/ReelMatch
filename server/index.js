const express = require("express");
const path = require("node:path");
require("dotenv").config();
const OpenAI = require("openai");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
const PORT = Number(process.env.PORT) || 3001;
const TMDB_TOKEN = process.env.TMDB_TOKEN || process.env.TMDB_READ_ACCESS_TOKEN;
const AI_ENABLED = process.env.ENABLE_PUBLIC_AI === "true";
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 25000,
      maxRetries: 0,
    })
  : null;
const usage = new Map();
let globalRequests = 0;
const validType = (x) =>
  x &&
  ["movie", "tv"].includes(x.type) &&
  Number.isSafeInteger(x.id) &&
  x.id > 0;
const itemKey = (x) => `${x.type}:${x.id}`;
const titleKey = (x) => (x.title || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
const categories = [
  "Perfect Match",
  "Highly Likely",
  "Worth a Watch",
  "Unlikely Match",
  "Not for You",
];
function cleanText(v, n = 150) {
  return typeof v === "string" ? v.slice(0, n) : "";
}
function validateTaste(body) {
  const favorites = body?.favorites;
  if (
    !Array.isArray(favorites) ||
    favorites.length < 1 ||
    favorites.length > 30 ||
    !favorites.every(validType)
  )
    return null;
  const feedback = Array.isArray(body.feedback)
    ? body.feedback
        .slice(0, 150)
        .filter(
          (x) =>
            validType(x) && ["love", "watch", "seen", "no"].includes(x.value),
        )
    : [];
  const p =
    body.preferences && typeof body.preferences === "object"
      ? body.preferences
      : {};
  return {
    favorites,
    feedback,
    preferences: {
      mood: cleanText(p.mood),
      pace: cleanText(p.pace),
      format: cleanText(p.format),
    },
  };
}
async function tmdb(route, params = {}) {
  if (!TMDB_TOKEN) {
    const e = new Error("TMDB is not configured");
    e.status = 503;
    throw e;
  }
  const url = new URL("https://api.themoviedb.org/3/" + route);
  Object.entries(params).forEach(([k, v]) =>
    url.searchParams.set(k, String(v)),
  );
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const e = new Error("TMDB request failed");
    e.status = 502;
    throw e;
  }
  return response.json();
}
function movie(x, type = x.media_type) {
  return {
    id: x.id,
    type,
    title: x.title || x.name || "",
    year: (x.release_date || x.first_air_date || "").slice(0, 4),
    releaseDate: x.release_date || x.first_air_date || "",
    poster: x.poster_path
      ? `https://image.tmdb.org/t/p/w342${x.poster_path}`
      : null,
    overview: cleanText(x.overview, 450),
    popularity: x.popularity || 0,
    voteCount: x.vote_count || 0,
    rating: x.vote_average || 0,
  };
}
function fail(res, e, label) {
  console.error(`[ReelMatch] ${label}:`, e.status || "", e.message);
  res
    .status(e.status || 502)
    .json({
      error: e.status === 503 ? e.message : `${label} temporarily unavailable.`,
    });
}
function aiGate(req, res, next) {
  if (!AI_ENABLED)
    return res
      .status(503)
      .json({
        error: "AI features are temporarily disabled for public visitors.",
      });
  if (!openai) return res.status(503).json({ error: "AI is not configured." });
  const ip = req.ip;
  const now = Date.now();
  const times = (usage.get(ip) || []).filter((t) => now - t < 3600000);
  if (times.length >= 20)
    return res
      .status(429)
      .json({ error: "AI request limit reached. Please try again later." });
  times.push(now);
  usage.set(ip, times);
  globalRequests++;
  next();
}
app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    service: "ReelMatch",
    tmdbConfigured: !!TMDB_TOKEN,
    aiEnabled: AI_ENABLED,
  }),
);
app.get("/api/test", async (req, res) => {
  try {
    const x = await tmdb("movie/550");
    res.json({ connected: true, title: x.title, releaseDate: x.release_date });
  } catch (e) {
    fail(res, e, "TMDB test");
  }
});
app.get("/api/search", async (req, res) => {
  const q = cleanText(req.query.query || req.query.q, 100).trim();
  if (q.length < 2)
    return res.status(400).json({ error: "Enter at least two characters." });
  try {
    const data = await tmdb("search/multi", {
      query: q,
      include_adult: "false",
      language: "en-US",
    });
    res.json(
      (data.results || [])
        .filter((x) => ["movie", "tv"].includes(x.media_type))
        .slice(0, 16)
        .map((x) => movie(x)),
    );
  } catch (e) {
    fail(res, e, "Search");
  }
});
app.get("/api/trending", async (req, res) => {
  try {
    const data = await tmdb("trending/all/week", { language: "en-US" });
    res.json({
      results: (data.results || [])
        .filter((x) => ["movie", "tv"].includes(x.media_type) && x.poster_path)
        .slice(0, 18)
        .map((x) => movie(x)),
    });
  } catch (e) {
    fail(res, e, "Trending");
  }
});
const discoveryRows = [
  ["Popular Movies", "movie", {}],
  ["Popular TV Shows", "tv", {}],
  ["Action & Adventure", "movie", { with_genres: "28,12" }],
  ["Comedy", "movie", { with_genres: "35" }],
  ["Drama", "movie", { with_genres: "18" }],
  ["Science Fiction", "movie", { with_genres: "878" }],
  ["Horror & Thriller", "movie", { with_genres: "27,53" }],
  ["Romance", "movie", { with_genres: "10749" }],
  ["Animation & Family", "movie", { with_genres: "16,10751" }],
  ["Critically Loved TV", "tv", { sort_by: "vote_average.desc", "vote_count.gte": "250" }],
];
app.get("/api/discovery", async (req, res) => {
  try {
    const rows = await Promise.all(discoveryRows.map(async ([title, type, params]) => {
      const data = await tmdb(`discover/${type}`, { ...params, language: "en-US", include_adult: "false", sort_by: params.sort_by || "popularity.desc" });
      return { title, items: (data.results || []).filter((x) => x.poster_path).slice(0, 12).map((x) => movie(x, type)) };
    }));
    res.json({ rows });
  } catch (e) { fail(res, e, "Discovery collections"); }
});
async function getCandidates(taste, page = 1) {
  const sources = taste.favorites.slice(0, 6);
  const responses = await Promise.all(
    sources.flatMap((f) => [page, page + 1].map(async (sourcePage) => {
      try {
        return await tmdb(`${f.type}/${f.id}/recommendations`, {
          page: Math.max(1, Math.min(3, sourcePage)),
          language: "en-US",
        });
      } catch {
        return { results: [] };
      }
    })),
  );
  const exclude = new Set(taste.favorites.map(itemKey));
  taste.feedback
    .filter((x) => ["seen", "no", "love"].includes(x.value))
    .forEach((x) => exclude.add(itemKey(x)));
  const out = new Map();
  responses.forEach((data, i) => {
    for (const x of data.results || []) {
      const m = movie(x, sources[Math.floor(i / 2)].type);
      if (m.poster && m.title && !exclude.has(itemKey(m))) {
        const normalizedTitle = titleKey(m);
        if (normalizedTitle && !out.has(normalizedTitle)) out.set(normalizedTitle, m);
      }
    }
  });
  return [...out.values()]
    .sort(
      (a, b) =>
        b.rating * Math.log1p(b.voteCount) - a.rating * Math.log1p(a.voteCount),
    )
    .slice(0, 100);
}
async function askAI(prompt, schema, name) {
  const r = await openai.responses.create({
    model: MODEL,
    input: prompt,
    max_output_tokens: 5000,
    text: { format: { type: "json_schema", name, strict: true, schema } },
  });
  if (!r.output_text) throw Error("AI returned no text");
  return JSON.parse(r.output_text);
}
app.post("/api/recommend", aiGate, async (req, res) => {
  const taste = validateTaste(req.body);
  if (!taste)
    return res
      .status(400)
      .json({ error: "Choose at least one valid favorite." });
  const excluded = new Set(
    Array.isArray(req.body.exclude)
      ? req.body.exclude.filter((x) => typeof x === "string").slice(-250)
      : [],
  );
  try {
    let candidates = await getCandidates(taste, Number(req.body.page) || 1);
    let fresh = candidates.filter((x) => !excluded.has(itemKey(x)));
    if (!fresh.length) fresh = candidates;
    if (!fresh.length) return res.json({ results: [] });
    const pool = fresh.slice(0, 100);
    const rowNames = ["Best Matches", "More Like Your Favorites", "Hidden Gems", "Big Screen Energy", "Easy Watching", "Smart & Thought-Provoking", "High-Intensity Picks", "Feel-Good Picks", "Worth Exploring", "Wild Cards"];
    const prompt = `You are ReelMatch, a playful but accurate spoiler-free film advisor. Rank verified candidate IDs only. Use favorites as strong positive signals; Loved It as positive; Not for Me as negative; Want to Watch as interest only; Already Seen as neutral. Preferences are optional. Do not invent facts. Organize the candidates across exactly these rows: ${JSON.stringify(rowNames)}. Each row should contain 6 to 10 different candidate IDs when possible. Every candidate ID may appear only once across the entire response, so never repeat a movie in another row. Return a qualitative category and a specific concise reason for every pick.\nTaste: ${JSON.stringify(taste)}\nCandidates: ${JSON.stringify(pool.map((x) => ({ id: itemKey(x), title: x.title, overview: x.overview, year: x.year, rating: x.rating })))}`;
    const schema = {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              picks: { type: "array", items: { type: "object", properties: { id: { type: "string" }, category: { type: "string", enum: categories }, reason: { type: "string" } }, required: ["id", "category", "reason"], additionalProperties: false } },
            },
            required: ["title", "picks"],
            additionalProperties: false,
          },
        },
      },
      required: ["rows"],
      additionalProperties: false,
    };
    const ai = await askAI(prompt, schema, "reelmatch_recommendations");
    const map = new Map(pool.map((x) => [itemKey(x), x]));
    const used = new Set();
    const rows = (ai.rows || []).slice(0, 10).map((row, index) => ({
      title: cleanText(row.title, 60) || rowNames[index],
      items: (row.picks || []).map((pick) => {
        if (!map.has(pick.id) || used.has(pick.id)) return null;
        used.add(pick.id);
        return { ...map.get(pick.id), category: pick.category, reason: cleanText(pick.reason, 350) };
      }).filter(Boolean).slice(0, 10),
    })).filter((row) => row.items.length);
    res.json({ rows });
  } catch (e) {
    fail(res, e, "Recommendations");
  }
});
function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function matchPrompt(taste, selected) {
  return `You are ReelMatch, a playful Gen Z friend who gives spoiler-free movie advice. Be warm, natural, and specific—not robotic, corporate, or overly formal. Your response must have exactly two parts: first, one line containing only one of these exact categories: ${categories.join(", ")}. Then, on the next line, write a short 2-3 sentence message that sounds like a friend texting a recommendation. You may start casually with words like "heyyy", "okayyy", or "wait", but do not overdo slang. Use only the provided TMDB details and user taste. Never invent plot points or claim the user watched something they did not provide.\nTaste: ${JSON.stringify(taste)}\nTitle: ${JSON.stringify(selected)}`;
}
app.post("/api/match/stream", aiGate, async (req, res) => {
  const taste = validateTaste(req.body);
  const title = req.body?.title;
  if (!taste || !validType(title))
    return res.status(400).json({ error: "Select a title and at least one favorite." });
  res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders?.();
  try {
    const raw = await tmdb(`${title.type}/${title.id}`);
    const selected = movie(raw, title.type);
    const stream = await openai.responses.create({ model: MODEL, input: matchPrompt(taste, selected), max_output_tokens: 700, stream: true });
    let header = "";
    let pending = "";
    let categorySent = false;
    const sendWords = (text) => {
      pending += text;
      const parts = pending.split(/(?<=\s)/);
      pending = parts.pop() || "";
      parts.forEach((word) => sse(res, "delta", { text: word }));
    };
    for await (const event of stream) {
      if (event.type !== "response.output_text.delta") continue;
      const delta = event.delta || "";
      if (!categorySent) {
        header += delta;
        const newline = header.search(/\r?\n/);
        if (newline === -1) continue;
        const category = header.slice(0, newline).trim();
        const matched = categories.find((x) => x.toLowerCase() === category.toLowerCase()) || "Worth a Watch";
        sse(res, "category", { category: matched });
        categorySent = true;
        sendWords(header.slice(newline + (header[newline] === "\r" ? 2 : 1)));
      } else sendWords(delta);
    }
    if (!categorySent) {
      const fallback = header.trim();
      sse(res, "category", { category: categories.find((x) => fallback.toLowerCase().includes(x.toLowerCase())) || "Worth a Watch" });
      sendWords(fallback);
    }
    if (pending) sse(res, "delta", { text: pending });
    sse(res, "done", { title: selected });
    res.end();
  } catch (e) {
    console.error("[ReelMatch] Match analysis stream:", e.status || "", e.message);
    sse(res, "error", { error: e.status === 503 ? e.message : "Match analysis temporarily unavailable." });
    res.end();
  }
});
app.post("/api/match", aiGate, async (req, res) => {
  const taste = validateTaste(req.body);
  const title = req.body?.title;
  if (!taste || !validType(title))
    return res
      .status(400)
      .json({ error: "Select a title and at least one favorite." });
  try {
    const raw = await tmdb(`${title.type}/${title.id}`);
    const selected = movie(raw, title.type);
    const prompt = `You are ReelMatch, a playful Gen Z friend giving spoiler-free movie advice. Use only the provided TMDB details and user taste. Sound casual, warm, and specific, like a friend texting—not like an AI or corporate review. You may start with "heyyy", "okayyy", or "wait". Give one qualitative match category and a specific 2-3 sentence reason. No invented plot points.\nTaste: ${JSON.stringify(taste)}\nTitle: ${JSON.stringify(selected)}`;
    const schema = {
      type: "object",
      properties: {
        category: { type: "string", enum: categories },
        reason: { type: "string" },
      },
      required: ["category", "reason"],
      additionalProperties: false,
    };
    const result = await askAI(prompt, schema, "reelmatch_match");
    res.json({ ...result, title: selected });
  } catch (e) {
    fail(res, e, "Match analysis");
  }
});
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API route not found." }),
);
app.get("/{*path}", (req, res) =>
  res.sendFile(path.join(distPath, "index.html")),
);
if (require.main === module)
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`ReelMatch API running on port ${PORT}`),
  );
module.exports = app;
