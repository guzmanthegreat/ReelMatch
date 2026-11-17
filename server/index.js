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

const config = require("./config");
const PORT = config.PORT;
const TMDB_TOKEN = config.TMDB_TOKEN;
const AI_ENABLED = config.AI_ENABLED;
const OPENAI_MODEL = config.OPENAI_MODEL;
const openai = config.openai;

const validation = require("./validation");
const cleanText = validation.cleanText;
const isValidTitle = validation.isValidTitle;
const itemKey = validation.itemKey;
const normalizedTitle = validation.normalizedTitle;
const sendError = validation.sendError;
const tmdbMovie = validation.tmdbMovie;
const validateTaste = validation.validateTaste;
const MATCH_CATEGORIES = validation.MATCH_CATEGORIES;

const tmdbClient = require("./tmdb");
const tmdb = tmdbClient.tmdb;

const ai = require("./ai");
const askOpenAI = ai.askOpenAI;
const sendSse = ai.sendSse;
const buildMatchPrompt = ai.buildMatchPrompt;

const rateLimit = require("./rateLimit");
const requireAI = rateLimit.requireAI;

// -----------------------------
// TMDB routes
// -----------------------------

// Lets Render check whether the server is running and whether APIs are configured.
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "ReelMatch",
    tmdbConfigured: Boolean(TMDB_TOKEN),
    aiEnabled: AI_ENABLED,
  });
});

// Searches TMDB and returns movie and TV results in the app's shared format.
app.get("/api/search", async (req, res) => {
  // Search results are ranked so exact title matches appear first.
  let searchText = req.query.query;
  if (!searchText) {
    searchText = req.query.q;
  }
  const query = cleanText(searchText, 100).trim();
  if (query.length < 2) {
    return res.status(400).json({ error: "Enter at least two characters." });
  }

  try {
    // Normalize punctuation and spacing so exact and partial matches are easier to compare.
    // This lets "Spider-Man" and "Spider Man" compare as the same search.
    function normalizeSearchText(value) {
      let text = value;
      if (!text) {
        text = "";
      }

      text = String(text);
      text = text.toLocaleLowerCase();
      text = text.replace(/[^a-z0-9]+/g, " ");
      text = text.trim();
      text = text.replace(/\s+/g, " ");
      return text;
    }

    const normalizedQuery = normalizeSearchText(query);
    const raw = await tmdb("search/multi", {
      query,
      include_adult: "false",
      language: "en-US",
      page: 1,
    });

    const supportedResults = [];
    if (Array.isArray(raw.results)) {
      for (let index = 0; index < raw.results.length; index += 1) {
        const item = raw.results[index];
        const isSupportedType =
          item.media_type === "movie" || item.media_type === "tv";
        if (isSupportedType && item.poster_path) {
          supportedResults.push(item);
        }
      }
    }

    // Score each result by exact title, partial title, then popularity.
    function getSearchScore(item) {
      const names = [
        item.title,
        item.name,
        item.original_title,
        item.original_name,
      ];
      let hasPartialMatch = false;

      for (let index = 0; index < names.length; index += 1) {
        const name = normalizeSearchText(names[index]);
        if (name === normalizedQuery) {
          return 0;
        }
        if (name.startsWith(normalizedQuery)) {
          hasPartialMatch = true;
        }
      }

      if (hasPartialMatch) {
        return 1;
      }
      return 2;
    }

    supportedResults.sort((firstItem, secondItem) => {
      const scoreDifference =
        getSearchScore(firstItem) - getSearchScore(secondItem);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      let firstPopularity = firstItem.popularity;
      if (!firstPopularity) {
        firstPopularity = 0;
      }
      let secondPopularity = secondItem.popularity;
      if (!secondPopularity) {
        secondPopularity = 0;
      }
      return secondPopularity - firstPopularity;
    });

    // Convert results, skip duplicate movies or shows, and keep at most 24.
    const results = [];
    const savedResultIds = [];
    for (let index = 0; index < supportedResults.length; index += 1) {
      const item = supportedResults[index];
      const title = tmdbMovie(item, item.media_type);
      const titleId = itemKey(title);
      let alreadyIncluded = false;

      for (let savedIndex = 0; savedIndex < savedResultIds.length; savedIndex += 1) {
        if (savedResultIds[savedIndex] === titleId) {
          alreadyIncluded = true;
          break;
        }
      }

      if (title.title && !alreadyIncluded) {
        results.push(title);
        savedResultIds.push(titleId);
      }

      if (results.length === 24) {
        break;
      }
    }

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

// Loads each predefined TMDB collection for the onboarding screen.
app.get("/api/discovery", async (req, res) => {
  try {
    // Promise.all loads every row at the same time, making onboarding faster.
    async function loadDiscoveryRow(row) {
      const title = row[0];
      const type = row[1];
      const filters = row[2];
      const requestParameters = {};
      const filterNames = Object.keys(filters);

      for (let index = 0; index < filterNames.length; index += 1) {
        const filterName = filterNames[index];
        requestParameters[filterName] = filters[filterName];
      }

      requestParameters.language = "en-US";
      requestParameters.include_adult = "false";
      requestParameters.sort_by = filters.sort_by;
      if (!requestParameters.sort_by) {
        requestParameters.sort_by = "popularity.desc";
      }

      const raw = await tmdb(`discover/${type}`, requestParameters);
      const items = [];
      if (Array.isArray(raw.results)) {
        for (let index = 0; index < raw.results.length; index += 1) {
          const item = raw.results[index];
          if (item.poster_path && items.length < 12) {
            items.push(tmdbMovie(item, type));
          }
        }
      }

      return { title, items };
    }

    const rowRequests = [];
    for (let index = 0; index < discoveryRows.length; index += 1) {
      rowRequests.push(loadDiscoveryRow(discoveryRows[index]));
    }
    const rows = await Promise.all(rowRequests);
    res.json({ rows });
  } catch (error) {
    sendError(res, error, "Discovery collections");
  }
});

// -----------------------------
// Recommendation route
// -----------------------------

// Builds a list of real, non-excluded titles for OpenAI to rank.
async function getCandidates(taste, page) {
  if (page === undefined) {
    page = 1;
  }

  // OpenAI only ranks titles returned by TMDB.
  const favorites = [];
  for (let index = 0; index < taste.favorites.length && index < 6; index += 1) {
    favorites.push(taste.favorites[index]);
  }

  // Limit how far through TMDB recommendations a request can page.
  let requestedPage = Number(page);
  if (!requestedPage) {
    requestedPage = 1;
  }
  const pages = Math.max(1, Math.min(3, requestedPage));

  async function loadRecommendationPage(favorite, sourcePage) {
    try {
      return await tmdb(
        `${favorite.type}/${favorite.id}/recommendations`,
        {
          page: sourcePage,
          language: "en-US",
        },
      );
    } catch {
      // One unavailable favorite should not prevent other favorites from
      // producing recommendations.
      return { results: [] };
    }
  }

  // Collect requests first, then wait for all favorites' requests together.
  const responseRequests = [];
  const responseFavoriteTypes = [];
  for (let favoriteIndex = 0; favoriteIndex < favorites.length; favoriteIndex += 1) {
    const favorite = favorites[favoriteIndex];
    for (let pageOffset = 0; pageOffset < 2; pageOffset += 1) {
      const sourcePage = pages + pageOffset;
      responseRequests.push(
        loadRecommendationPage(favorite, sourcePage),
      );
      responseFavoriteTypes.push(favorite.type);
    }
  }
  const responses = await Promise.all(responseRequests);

  // Do not recommend favorites or titles the user marked seen or not for them.
  const excludedTitleIds = [];
  for (let index = 0; index < taste.favorites.length; index += 1) {
    excludedTitleIds.push(itemKey(taste.favorites[index]));
  }
  for (let index = 0; index < taste.feedback.length; index += 1) {
    const feedbackItem = taste.feedback[index];
    const shouldExclude =
      feedbackItem.value === "seen" ||
      feedbackItem.value === "no" ||
      feedbackItem.value === "love";
    if (shouldExclude) {
      excludedTitleIds.push(itemKey(feedbackItem));
    }
  }

  const candidates = [];
  const candidateNames = [];
  for (let responseIndex = 0; responseIndex < responses.length; responseIndex += 1) {
    const response = responses[responseIndex];
    const sourceType = responseFavoriteTypes[responseIndex];
    if (!Array.isArray(response.results)) {
      continue;
    }

    for (let itemIndex = 0; itemIndex < response.results.length; itemIndex += 1) {
      const raw = response.results[itemIndex];
      const candidate = tmdbMovie(raw, sourceType);
      const title = normalizedTitle(candidate);
      const candidateId = itemKey(candidate);
      let isExcluded = false;
      for (let excludedIndex = 0; excludedIndex < excludedTitleIds.length; excludedIndex += 1) {
        if (excludedTitleIds[excludedIndex] === candidateId) {
          isExcluded = true;
          break;
        }
      }

      let nameAlreadyUsed = false;
      for (let nameIndex = 0; nameIndex < candidateNames.length; nameIndex += 1) {
        if (candidateNames[nameIndex] === title) {
          nameAlreadyUsed = true;
          break;
        }
      }

      if (
        candidate.poster &&
        candidate.title &&
        !isExcluded &&
        title &&
        !nameAlreadyUsed
      ) {
        candidates.push(candidate);
        candidateNames.push(title);
      }
    }
  }

  // Sort highly rated titles ahead of titles with fewer ratings.
  function getCandidateScore(candidate) {
    return candidate.rating * Math.log1p(candidate.voteCount);
  }
  candidates.sort((firstCandidate, secondCandidate) => {
    return getCandidateScore(secondCandidate) - getCandidateScore(firstCandidate);
  });

  const topCandidates = [];
  for (let index = 0; index < candidates.length && index < 100; index += 1) {
    topCandidates.push(candidates[index]);
  }
  return topCandidates;
}

// requireAI checks the AI setting and request limits before this route runs.
app.post("/api/recommend", requireAI, async (req, res) => {
  // Validate user data before using it to fetch or rank titles.
  const taste = validateTaste(req.body);
  if (!taste) {
    return res
      .status(400)
      .json({ error: "Choose at least one valid favorite." });
  }

  try {
    // Read recent title IDs from the browser so recommendations can avoid repeats.
    const history = [];
    if (Array.isArray(req.body.exclude)) {
      for (let index = 0; index < req.body.exclude.length; index += 1) {
        const titleId = req.body.exclude[index];
        if (typeof titleId === "string") {
          history.push(titleId);
          if (history.length > 250) {
            history.shift();
          }
        }
      }
    }

    const candidates = await getCandidates(taste, req.body.page);
    const fresh = [];
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const candidateId = itemKey(candidate);
      let wasShownBefore = false;
      for (let historyIndex = 0; historyIndex < history.length; historyIndex += 1) {
        if (history[historyIndex] === candidateId) {
          wasShownBefore = true;
          break;
        }
      }
      if (!wasShownBefore) {
        fresh.push(candidate);
      }
    }

    // If every candidate was already shown, reuse the full candidate list.
    let candidatesToUse = candidates;
    if (fresh.length > 0) {
      candidatesToUse = fresh;
    }

    const pool = [];
    for (let index = 0; index < candidatesToUse.length && index < 100; index += 1) {
      pool.push(candidatesToUse[index]);
    }
    if (pool.length === 0) {
      return res.json({ results: [] });
    }

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

    // Ask OpenAI to group candidate IDs into rows without inventing new titles.
    const promptCandidates = [];
    for (let index = 0; index < pool.length; index += 1) {
      const item = pool[index];
      promptCandidates.push({
        id: itemKey(item),
        title: item.title,
        overview: item.overview,
        year: item.year,
        rating: item.rating,
      });
    }

    const prompt = `You are ReelMatch, a playful but accurate spoiler-free film advisor. Rank verified candidate IDs only. Use favorites as strong positive signals; Loved It as positive; Not for Me as negative; Want to Watch as interest only; Already Seen as neutral. Preferences are optional. Do not invent facts. Organize candidates across exactly these rows: ${JSON.stringify(rowNames)}. Each row should contain 5 to 8 different candidate IDs when possible. Every candidate ID may appear only once across the entire response. Return only the category for each pick; do not write explanations here because explanations are generated on the match-details screen.\nTaste: ${JSON.stringify(taste)}\nCandidates: ${JSON.stringify(promptCandidates)} `;

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

    // Match AI-selected IDs to verified candidates, and skip repeated picks.
    const usedCandidateIds = [];
    const rows = [];
    let resultRows = result.rows;
    if (!Array.isArray(resultRows)) {
      resultRows = [];
    }

    for (let rowIndex = 0; rowIndex < resultRows.length && rowIndex < 10; rowIndex += 1) {
      const resultRow = resultRows[rowIndex];
      let rowTitle = cleanText(resultRow.title, 60);
      if (!rowTitle) {
        rowTitle = rowNames[rowIndex];
      }

      const allRowItems = [];
      let picks = resultRow.picks;
      if (!Array.isArray(picks)) {
        picks = [];
      }

      for (let pickIndex = 0; pickIndex < picks.length; pickIndex += 1) {
        const pick = picks[pickIndex];
        let candidate = null;
        for (let candidateIndex = 0; candidateIndex < pool.length; candidateIndex += 1) {
          if (itemKey(pool[candidateIndex]) === pick.id) {
            candidate = pool[candidateIndex];
            break;
          }
        }

        let candidateWasUsed = false;
        for (
          let usedIndex = 0;
          usedIndex < usedCandidateIds.length;
          usedIndex += 1
        ) {
          if (usedCandidateIds[usedIndex] === pick.id) {
            candidateWasUsed = true;
            break;
          }
        }

        if (!candidate || candidateWasUsed) {
          continue;
        }

        usedCandidateIds.push(pick.id);
        allRowItems.push({
          // Copy the verified title fields, then add its category and explanation.
          ...candidate,
          category: pick.category,
          reason: "",
        });
      }

      const rowItems = [];
      for (let itemIndex = 0; itemIndex < allRowItems.length && itemIndex < 10; itemIndex += 1) {
        rowItems.push(allRowItems[itemIndex]);
      }

      if (rowItems.length > 0) {
        rows.push({
          title: rowTitle,
          items: rowItems,
        });
      }
    }

    return res.json({ rows });
  } catch (error) {
    return sendError(res, error, "Recommendations");
  }
});

// -----------------------------
// Streaming match explanation
// -----------------------------



// Sends a title's category and explanation to the browser as the AI responds.
// requireAI checks the AI setting and request limits before this route runs.
app.post("/api/match/stream", requireAI, async (req, res) => {
  // A match requires valid taste data and a valid movie or TV title.
  const taste = validateTaste(req.body);
  let requestedTitle = null;
  if (req.body) {
    requestedTitle = req.body.title;
  }
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
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  try {
    // Get current title details from TMDB before asking OpenAI to analyze it.
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
    function sendWords(text) {
      pendingWords += text;
      let wordStart = 0;

      // Send text through the last space; keep the unfinished word for later.
      for (let index = 0; index < pendingWords.length; index += 1) {
        const character = pendingWords[index];
        if (/\s/.test(character)) {
          const completeWord = pendingWords.slice(wordStart, index + 1);
          sendSse(res, "delta", { text: completeWord });
          wordStart = index + 1;
        }
      }

      pendingWords = pendingWords.slice(wordStart);
    }

    // The OpenAI stream is asynchronous, so for-await reads each event as it arrives.
    for await (const event of stream) {
      if (event.type !== "response.output_text.delta") continue;
      let text = event.delta;
      if (!text) {
        text = "";
      }

      if (!categorySent) {
        header += text;
        // The first line is the category; wait until its newline arrives.
        const newline = header.search(/\r?\n/);
        if (newline === -1) continue;

        const categoryText = header.slice(0, newline).trim().toLowerCase();
        let category = "Worth a Watch";
        for (let index = 0; index < MATCH_CATEGORIES.length; index += 1) {
          const availableCategory = MATCH_CATEGORIES[index];
          if (availableCategory.toLowerCase() === categoryText) {
            category = availableCategory;
            break;
          }
        }
        sendSse(res, "category", { category });
        categorySent = true;
        // Send any explanation text that arrived after the category line.
        let lineEndingLength = 1;
        if (header[newline] === "\r") {
          lineEndingLength = 2;
        }
        sendWords(header.slice(newline + lineEndingLength));
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
    if (pendingWords) {
      sendSse(res, "delta", { text: pendingWords });
    }
    sendSse(res, "done", { title });
    res.end();
  } catch (error) {
    console.error("[ReelMatch] Match analysis stream:", error.message);
    let errorMessage = "Match analysis temporarily unavailable.";
    if (error.status === 503) {
      errorMessage = error.message;
    }
    sendSse(res, "error", {
      error: errorMessage,
    });
    res.end();
  }
});

// -----------------------------
// Static frontend and startup
// -----------------------------

const distPath = path.resolve(__dirname, "../dist");
// Serve the production React files from the same Express server as the API.
app.use(express.static(distPath));

// Return JSON for unknown API routes, but let React handle browser routes.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

if (require.main === module) {
  // Start the server only when this file is run directly, not when tests import it.
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ReelMatch API running on port ${PORT}`);
  });
}

// Export the app and validation helpers so tests can use them without starting the server.
module.exports = app;
module.exports.validateTaste = validateTaste;
module.exports.cleanText = cleanText;
module.exports.categories = MATCH_CATEGORIES;
