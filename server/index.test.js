const assert = require("node:assert/strict");
const test = require("node:test");

const server = require("./index.js");

test("validateTaste accepts bounded, valid taste data", () => {
  const taste = server.validateTaste({
    favorites: [{ id: 550, type: "movie", title: "Fight Club" }],
    feedback: [{ id: 680, type: "movie", value: "love", title: "Pulp Fiction" }],
    preferences: { mood: "Intense", pace: "Fast-paced", extra: "ignored" },
  });

  assert.equal(taste.favorites.length, 1);
  assert.equal(taste.feedback[0].value, "love");
  assert.deepEqual(taste.preferences, {
    mood: "Intense",
    pace: "Fast-paced",
    format: "",
  });
});

test("validateTaste rejects malformed and oversized favorites", () => {
  assert.equal(server.validateTaste({}), null);
  assert.equal(server.validateTaste({ favorites: [{ id: -1, type: "movie" }] }), null);

  const manyFavorites = [];
  for (let id = 1; id <= 31; id += 1) {
    manyFavorites.push({ id, type: "movie" });
  }

  assert.equal(
    server.validateTaste({
      favorites: manyFavorites,
    }),
    null,
  );
});

test("validateTaste drops invalid feedback and bounds text fields", () => {
  const taste = server.validateTaste({
    favorites: [{ id: 550, type: "movie" }],
    feedback: [
      { id: 680, type: "movie", value: "invalid" },
      { id: 680, type: "movie", value: "seen" },
    ],
    preferences: { mood: "x".repeat(200) },
  });

  assert.equal(taste.feedback.length, 1);
  assert.equal(taste.feedback[0].value, "seen");
  assert.equal(taste.preferences.mood.length, 150);
});

test("cleanText safely normalizes non-string values", () => {
  assert.equal(server.cleanText(null), "");
  assert.equal(server.cleanText(42), "");
  assert.equal(server.cleanText("abcdef", 3), "abc");
});
