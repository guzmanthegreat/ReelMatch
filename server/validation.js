// Keeps text values short before they are used in prompts or responses.
function cleanText(value, maxLength) {
  if (maxLength === undefined) {
    maxLength = 150;
  }

  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, maxLength);
}

// These are the only match labels the frontend expects.
const MATCH_CATEGORIES = [
  "Perfect Match",
  "Highly Likely",
  "Worth a Watch",
  "Unlikely Match",
  "Not for You",
];

// Checks that a title has a supported type and a positive TMDB ID.
function isValidTitle(title) {
  if (!title) {
    return false;
  }
  if (title.type !== "movie" && title.type !== "tv") {
    return false;
  }
  if (!Number.isSafeInteger(title.id)) {
    return false;
  }
  if (title.id <= 0) {
    return false;
  }
  return true;
}

// Creates an ID that keeps a movie separate from a show with the same TMDB number.
function itemKey(item) {
  return `${item.type}:${item.id}`;
}

// Normalizes title text so small case or spacing differences still match.
function normalizedTitle(item) {
  let title = item.title;
  if (!title) {
    title = "";
  }

  title = title.trim();
  title = title.toLocaleLowerCase();
  title = title.replace(/\s+/g, " ");
  return title;
}

// Logs the full service error and sends a safer message to the browser.
function sendError(res, error, label) {
  let status = error.status;
  if (!status) {
    status = 502;
  }

  let loggedStatus = error.status;
  if (!loggedStatus) {
    loggedStatus = "";
  }
  console.error(`[ReelMatch] ${label}:`, loggedStatus, error.message);

  let message = `${label} temporarily unavailable.`;
  if (status === 503) {
    message = error.message;
  }
  return res.status(status).json({ error: message });
}

// Converts TMDB movie and TV records into one shape for the frontend.
function tmdbMovie(raw, type) {
  if (type === undefined) {
    type = raw.media_type;
  }

  // TMDB calls movies `title` and TV shows `name`. Convert both to `title`
  // so the React app only needs one data shape.
  let title = raw.title;
  if (!title) {
    title = raw.name;
  }
  if (!title) {
    title = "";
  }

  let releaseDate = raw.release_date;
  if (!releaseDate) {
    releaseDate = raw.first_air_date;
  }
  if (!releaseDate) {
    releaseDate = "";
  }

  let poster = null;
  if (raw.poster_path) {
    poster = `https://image.tmdb.org/t/p/w342${raw.poster_path}`;
  }

  let popularity = raw.popularity;
  if (!popularity) {
    popularity = 0;
  }

  let voteCount = raw.vote_count;
  if (!voteCount) {
    voteCount = 0;
  }

  let rating = raw.vote_average;
  if (!rating) {
    rating = 0;
  }

  return {
    id: raw.id,
    type,
    title,
    year: releaseDate.slice(0, 4),
    releaseDate,
    poster,
    overview: cleanText(raw.overview, 450),
    popularity,
    voteCount,
    rating,
  };
}

// Checks browser-provided taste data and keeps only supported values.
function validateTaste(body) {
  if (!body) {
    return null;
  }

  const favorites = body.favorites;
  // Recommendations need at least one valid favorite and accept at most 30.
  if (
    !Array.isArray(favorites) ||
    favorites.length < 1 ||
    favorites.length > 30
  ) {
    return null;
  }

  for (let index = 0; index < favorites.length; index += 1) {
    if (!isValidTitle(favorites[index])) {
      return null;
    }
  }

  // Ignore unsupported reactions and limit how many feedback items are processed.
  const feedback = [];
  if (Array.isArray(body.feedback)) {
    const feedbackLimit = Math.min(body.feedback.length, 150);
    for (let index = 0; index < feedbackLimit; index += 1) {
      const item = body.feedback[index];
      if (!isValidTitle(item)) {
        continue;
      }

      const isSupportedReaction =
        item.value === "love" ||
        item.value === "watch" ||
        item.value === "seen" ||
        item.value === "no";
      if (isSupportedReaction) {
        feedback.push(item);
      }
    }
  }

  // Return only the preference fields the app understands.
  let preferences = {};
  if (body.preferences && typeof body.preferences === "object") {
    preferences = body.preferences;
  }

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


module.exports = {
  cleanText,
  isValidTitle,
  itemKey,
  normalizedTitle,
  sendError,
  tmdbMovie,
  validateTaste,
  MATCH_CATEGORIES,
};

