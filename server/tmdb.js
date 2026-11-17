const config = require("./config");
const TMDB_TOKEN = config.TMDB_TOKEN;

// Sends a request to TMDB and returns the JSON response.
async function tmdb(route, params) {
  if (params === undefined) {
    params = {};
  }

  // The browser never sees TMDB_TOKEN. It only calls our own /api routes.
  if (!TMDB_TOKEN) {
    const error = new Error("TMDB is not configured");
    error.status = 503;
    throw error;
  }

  const url = new URL(`https://api.themoviedb.org/3/${route}`);
  // Add each filter or query value to the URL.
  const parameterNames = Object.keys(params);
  for (let index = 0; index < parameterNames.length; index += 1) {
    const name = parameterNames[index];
    const value = params[name];
    url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  // Stop here if TMDB returned an HTTP error.
  if (!response.ok) {
    const error = new Error("TMDB request failed");
    error.status = 502;
    throw error;
  }

  return response.json();
}


module.exports = { tmdb };

