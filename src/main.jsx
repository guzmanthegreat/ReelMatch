import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
const STORE = "reelmatch-ready-taste";
const read = () => {
  try {
    return (
      JSON.parse(localStorage.getItem(STORE)) || {
        favorites: [],
        feedback: {},
        history: [],
        preferences: {},
      }
    );
  } catch {
    return { favorites: [], feedback: {}, history: [], preferences: {} };
  }
};
const key = (x) => x.type + ":" + x.id;
const QUESTIONS = [
  {
    id: "mood",
    title: "What are you in the mood for?",
    options: [
      "Surprise me",
      "Something intense",
      "Feel-good",
      "Mind-bending",
      "Easy watching",
    ],
  },
  {
    id: "pace",
    title: "Your ideal pacing?",
    options: ["No preference", "Fast-paced", "Slow burn", "A bit of both"],
  },
  {
    id: "format",
    title: "What should we prioritize?",
    options: ["Movies and TV", "Movies", "TV shows"],
  },
];
async function api(url, options) {
  const r = await fetch(url, options);
  let d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
const post = (url, data) =>
  api(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
function Poster({ x }) {
  return x.poster ? (
    <img src={x.poster} alt={x.title + " poster"} loading="lazy" />
  ) : (
    <div className="missing">No poster</div>
  );
}
function App() {
  const [page, P] = useState("welcome"),
    [taste, T] = useState(read),
    [q, Q] = useState(""),
    [results, R] = useState([]),
    [trending, G] = useState([]),
    [picks, K] = useState([]),
    [selected, S] = useState(null),
    [match, M] = useState(null),
    [busy, B] = useState(false),
    [searchBusy, SB] = useState(false),
    [trendingBusy, TB] = useState(true),
    [error, E] = useState(""),
    [health, H] = useState(null),
    [pageNum, N] = useState(1),
    [tasteStep, TS] = useState(0),
    [showHistory, SH] = useState(false);
  const initialFavorites = useRef(read().favorites.length > 0);
  const autoRequested = useRef(false);
  useEffect(() => localStorage.setItem(STORE, JSON.stringify(taste)), [taste]);
  useEffect(() => {
    if (initialFavorites.current) P("discover");
  }, []);
  useEffect(() => {
    if (
      page === "discover" &&
      taste.favorites.length &&
      !picks.length &&
      !autoRequested.current
    ) {
      autoRequested.current = true;
      recommend();
    }
  }, [page, taste.favorites.length]);

  useEffect(() => {
    api("/api/health")
      .then(H)
      .catch(() => {});
    api("/api/trending")
      .then((d) => G(d.results || []))
      .catch((e) => E(e.message))
      .finally(() => TB(false));
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) {
      R([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      SB(true);
      api("/api/search?query=" + encodeURIComponent(q), { signal: ctrl.signal })
        .then((d) => {
          R(Array.isArray(d) ? d : []);
          E("");
        })
        .catch((e) => {
          if (e.name !== "AbortError") E(e.message);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) SB(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);
  const favorite = (x) =>
    T((t) => ({
      ...t,
      favorites: t.favorites.some((f) => key(f) === key(x))
        ? t.favorites.filter((f) => key(f) !== key(x))
        : [...t.favorites, x],
    }));
  const liked = (x) => taste.favorites.some((f) => key(f) === key(x));
  const feedback = (x, value) =>
    T((t) => {
      const updated = { ...t.feedback };
      if (updated[key(x)]?.value === value) delete updated[key(x)];
      else updated[key(x)] = { ...x, value };
      return { ...t, feedback: updated };
    });
  const payload = () => ({
    favorites: taste.favorites,
    feedback: Object.values(taste.feedback),
    preferences: taste.preferences || {},
  });
  const setPreference = (id, value) =>
    T((t) => ({
      ...t,
      preferences: { ...(t.preferences || {}), [id]: value },
    }));
  async function recommend() {
    if (busy) return;
    if (!taste.favorites.length) {
      P("onboard");
      E("Pick a movie to continue.");
      return;
    }
    B(true);
    E("");
    try {
      const d = await post("/api/recommend", {
        ...payload(),
        exclude: taste.history,
        page: pageNum,
      });
      K(Array.isArray(d.results) ? d.results : []);
      T((t) => ({
        ...t,
        history: [
          ...t.history.filter(
            (k) => !(d.results || []).some((x) => key(x) === k),
          ),
          ...(d.results || []).map(key),
        ].slice(-250),
      }));
      N((n) => (n >= 29 ? 1 : n + 2));
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  async function check(x) {
    S(x);
    M(null);
    P("check");
    Q("");
    R([]);
    B(true);
    E("");
    try {
      M(await post("/api/match", { ...payload(), title: x }));
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  const cards = (items, mode = "favorite") => (
    <div
      className={
        "poster-grid " + (mode === "favorite" ? "poster-carousel" : "")
      }
    >
      {items.map((x) => (
        <article
          className={
            "poster-card " +
            (mode === "favorite" && liked(x) ? "is-picked" : "")
          }
          key={key(x)}
        >
          <button
            className="poster-open"
            onClick={() => (mode === "favorite" ? favorite(x) : check(x))}
            aria-label={
              mode === "favorite"
                ? (liked(x) ? "Remove " : "Select ") + x.title
                : "See details for " + x.title
            }
          >
            <Poster x={x} />
            {mode === "favorite" && (
              <span className="poster-check">{liked(x) ? "✓" : "+"}</span>
            )}
            {mode !== "favorite" && x.category && (
              <span className="poster-match">{x.category}</span>
            )}
          </button>
          <div className="card-details">
            <strong title={x.title}>{x.title}</strong>
            <span>{x.year || (x.type === "tv" ? "TV" : "Movie")}</span>
            {mode !== "favorite" && (
              <div className="quick-actions">
                <button
                  className={
                    taste.feedback[key(x)]?.value === "watch" ? "active" : ""
                  }
                  onClick={() => feedback(x, "watch")}
                  aria-label={"Save " + x.title}
                >
                  ＋ <span>Watchlist</span>
                </button>
                <button
                  className={
                    taste.feedback[key(x)]?.value === "love" ? "active" : ""
                  }
                  onClick={() => feedback(x, "love")}
                  aria-label={"Love " + x.title}
                >
                  ♥
                </button>
                <button className="more-action" onClick={() => check(x)}>
                  Details ↗
                </button>
                <details className="reaction-menu">
                  <summary aria-label={"More reactions for " + x.title}>
                    •••
                  </summary>
                  <div className="reaction-options">
                    <button
                      className={
                        taste.feedback[key(x)]?.value === "seen" ? "active" : ""
                      }
                      onClick={() => feedback(x, "seen")}
                    >
                      Already seen
                    </button>
                    <button
                      className={
                        taste.feedback[key(x)]?.value === "no" ? "active" : ""
                      }
                      onClick={() => feedback(x, "no")}
                    >
                      Not for me
                    </button>
                  </div>
                </details>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
  const search = (
    <label className="search">
      <span aria-hidden="true">⌕</span>
      <input
        value={q}
        onChange={(e) => Q(e.target.value)}
        placeholder="Search real movies & TV shows…"
        aria-label="Search movies and TV shows"
      />
      {searchBusy && <span className="muted">Searching…</span>}
    </label>
  );
  return (
    <div className="app">
      <header className="header">
        <button
          className="brand"
          onClick={() => {
            P("welcome");
            Q("");
            E("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          reel<span>match.</span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={page === "discover" ? "current" : ""}
            onClick={() => {
              P(taste.favorites.length ? "discover" : "onboard");
              E("");
            }}
          >
            Discover
          </button>
          <button
            className={page === "taste" ? "current" : ""}
            onClick={() => {
              P("taste");
              E("");
            }}
          >
            My Taste
          </button>
        </nav>
      </header>
      {(busy || searchBusy || trendingBusy) && (
        <div
          className="screen-loading"
          role="status"
          aria-live="polite"
          aria-label="Loading"
        >
          <div className="screen-loading-content">
            <div className="screen-loading-spinner" aria-hidden="true" />
            <span>
              {busy
                ? page === "check"
                  ? "Checking your match…"
                  : "Finding your movies…"
                : searchBusy
                  ? "Searching movies…"
                  : "Loading movies…"}
            </span>
          </div>
        </div>
      )}
      <main>
        {page === "welcome" && (
          <section className="hero">
            <div className="hero-backdrop" aria-hidden="true">
              {trending.slice(0, 7).map((x) => (
                <div key={key(x)}>
                  <Poster x={x} />
                </div>
              ))}
            </div>
            <div className="hero-content">
              <div className="hero-kicker">REELMATCH</div>
              <h1>
                Movie night,
                <br />
                <em>solved.</em>
              </h1>
              <p>Movies you'll actually love.</p>
              <button
                className="primary hero-button"
                onClick={() => {
                  P("onboard");
                  E("");
                }}
              >
                Get Started <span>→</span>
              </button>
            </div>
          </section>
        )}
        {page === "onboard" && (
          <section className="section onboarding">
            <div className="step-label">STEP 1 OF 1</div>
            <h1>
              Pick movies you <em>love.</em>
            </h1>
            <p>Tap at least one poster.</p>
            {search}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {!trending.length && !error && q.trim().length < 2 && (
              <p className="loading-note" role="status">
                Loading movies…
              </p>
            )}
            <div className="collection-heading">
              <h2>
                {q.trim().length >= 2 ? "Search results" : "Popular right now"}
              </h2>
              <span>Scroll to explore →</span>
            </div>
            {cards(q.trim().length >= 2 ? results : trending)}
            <div className="sticky-next">
              <span>
                <strong>{taste.favorites.length}</strong> selected
              </span>
              <button
                className="primary"
                disabled={!taste.favorites.length}
                onClick={() => {
                  autoRequested.current = false;
                  P("discover");
                  K([]);
                  Q("");
                  E("");
                }}
              >
                Find My Movies <span>→</span>
              </button>
            </div>
          </section>
        )}
        {page === "discover" && (
          <section className="section discover">
            <div className="section-top">
              <div>
                <div className="step-label">CURATED FOR YOU</div>
                <h1>
                  Your next <em>favorite.</em>
                </h1>
              </div>
              <button
                className="secondary refresh"
                disabled={busy}
                onClick={recommend}
              >
                {busy ? "Finding…" : "↻ New picks"}
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {busy && (
              <p className="loading-note" role="status">
                Finding your movies…
              </p>
            )}
            {picks.length ? (
              cards(picks, "feedback")
            ) : !busy ? (
              <div className="empty">
                <p>
                  {taste.favorites.length
                    ? "Your next movie is one click away."
                    : "Pick some favorites to get started."}
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    taste.favorites.length ? recommend() : P("onboard")
                  }
                >
                  {taste.favorites.length
                    ? "Find movies →"
                    : "Pick favorites →"}
                </button>
              </div>
            ) : null}
            <div className="discover-bottom">
              <button
                className="secondary"
                onClick={() => {
                  Q("");
                  E("");
                  P("check");
                }}
              >
                Search any movie ↗
              </button>
            </div>
          </section>
        )}
        {page === "check" && (
          <section className="section">
            <div className="step-label">MOVIE DETAILS</div>
            <h1>
              Find a <em>movie.</em>
            </h1>
            <p>Search any title.</p>
            {search}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {selected && (
              <div className="selected-title">
                <Poster x={selected} />
                <div>
                  <div className="eyebrow">MATCH ANALYSIS</div>
                  <h2>
                    {selected.title}{" "}
                    <span className="muted">{selected.year}</span>
                  </h2>
                  {busy ? (
                    <p>Analyzing your taste…</p>
                  ) : match ? (
                    <>
                      {match.category && (
                        <h3 className="category">{match.category}</h3>
                      )}
                      <p>{match.reason}</p>
                    </>
                  ) : (
                    <p>Select a title to check your match.</p>
                  )}
                  <button
                    className="secondary"
                    onClick={() => favorite(selected)}
                  >
                    {liked(selected) ? "Remove favorite" : "+ Add favorite"}
                  </button>
                </div>
              </div>
            )}
            {q.trim().length >= 2 && cards(results, "check")}
          </section>
        )}
        {page === "taste" && (
          <section className="section">
            <div className="step-label">YOUR COLLECTION</div>
            <h1>
              My <em>Taste.</em>
            </h1>
            <p>Your favorites, all in one place.</p>
            <div className="taste-actions">
              <button className="secondary" onClick={() => P("onboard")}>
                + Add favorites
              </button>
              <button
                className="secondary subtle-control"
                onClick={() => SH((v) => !v)}
              >
                {showHistory ? "Hide" : "Show"} discovery history (
                {taste.history.length})
              </button>
            </div>
            <details className="taste-settings">
              <summary>Preferences</summary>
              <div className="preference-panel">
                {QUESTIONS.map((question) => (
                  <div className="preference-question" key={question.id}>
                    <h2>{question.title}</h2>
                    <div className="preference-options">
                      {question.options.map((option) => (
                        <button
                          key={option}
                          className={
                            (taste.preferences || {})[question.id] === option
                              ? "preference-choice chosen"
                              : "preference-choice"
                          }
                          aria-pressed={
                            (taste.preferences || {})[question.id] === option
                          }
                          onClick={() => setPreference(question.id, option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
            {showHistory && (
              <div className="history-note">
                ReelMatch remembers {taste.history.length} recently recommended
                titles in this browser to reduce repeats. This history is used
                for ranking, not as a watched list.{" "}
                <button
                  className="small-button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Clear recommendation history? Your favorites and reactions will stay saved.",
                      )
                    )
                      T((t) => ({ ...t, history: [] }));
                  }}
                >
                  Clear history
                </button>
              </div>
            )}
            <h2 className="collection-title">Favorites</h2>
            {taste.favorites.length ? (
              cards(taste.favorites)
            ) : (
              <div className="empty">
                No favorites yet. Add a few titles to start shaping your taste.
              </div>
            )}
            {[
              ["love", "Loved It"],
              ["watch", "Want to Watch"],
              ["seen", "Already Seen"],
              ["no", "Not for Me"],
            ].map(([v, label]) => {
              const items = Object.values(taste.feedback).filter(
                (x) => x.value === v,
              );
              return (
                <section
                  key={v}
                  className={
                    items.length ? "taste-group" : "taste-group is-empty"
                  }
                >
                  {items.length > 0 && (
                    <h2 className="collection-title">
                      {label} <span className="muted">({items.length})</span>
                    </h2>
                  )}
                  {items.length ? (
                    <div className="taste-list">
                      {items.map((x) => (
                        <div className="taste-row" key={key(x)}>
                          <button
                            className="taste-poster"
                            onClick={() => check(x)}
                            aria-label={"Check " + x.title}
                          >
                            <Poster x={x} />
                          </button>
                          <div className="taste-row-info">
                            <strong>{x.title}</strong>
                            <span className="muted">
                              {x.year || "Unknown year"} ·{" "}
                              {x.type === "tv" ? "TV" : "Movie"}
                            </span>
                          </div>
                          <button
                            className="small-button"
                            onClick={() => feedback(x, v)}
                            aria-label={"Remove " + label + " from " + x.title}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </section>
        )}
      </main>
      <footer>
        <div>
          <strong>
            reel<span>match.</span>
          </strong>
          <p>Made for the indecisive movie lover.</p>
        </div>
        <div className="attribution">
          <img src="/tmdb-logo.svg" alt="TMDB logo" />
          <p>
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </p>
        </div>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
