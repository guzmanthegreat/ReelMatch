import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STORE = "reelmatch-ready-taste";
const SESSION = "reelmatch-journey-started";
const key = (x) => `${x.type}:${x.id}`;
const titleKey = (x) => (x.title || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
const QUESTIONS = [
  { id: "mood", title: "What are you in the mood for?", options: ["Surprise me", "Something intense", "Feel-good", "Mind-bending", "Easy watching"] },
  { id: "pace", title: "Your ideal pacing?", options: ["No preference", "Fast-paced", "Slow burn", "A bit of both"] },
  { id: "format", title: "What should we prioritize?", options: ["Movies and TV", "Movies", "TV shows"] },
];

function freshTaste() { return { favorites: [], feedback: {}, history: [], preferences: {} }; }
function read() {
  try {
    if (!sessionStorage.getItem(SESSION)) { sessionStorage.setItem(SESSION, "1"); localStorage.removeItem(STORE); }
    return JSON.parse(localStorage.getItem(STORE)) || freshTaste();
  } catch { return freshTaste(); }
}
async function api(url, options) { const r = await fetch(url, options); const raw = await r.text(); let d = {}; try { d = raw ? JSON.parse(raw) : {}; } catch { d = {}; } if (!r.ok) throw Error(d.error || `Request failed (${r.status})`); return d; }
const post = (url, data) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
function Poster({ x }) { return x.poster ? <img src={x.poster} alt={`${x.title} poster`} loading="lazy" /> : <div className="missing">No poster</div>; }
function categoryClass(category) { return `category-${(category || "").toLowerCase().replaceAll(" ", "-")}`; }

function Carousel({ items, mode, liked, favorite, check }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [index, setIndex] = useState(1);
  const [visible, setVisible] = useState(1);
  const [transition, setTransition] = useState(true);
  const dragStartRef = useRef(null);
  const suppressClickRef = useRef(false);
  const uniqueItems = Array.from(new Map(items.map((x) => [titleKey(x), x])).values()).filter((x) => titleKey(x));
  const count = uniqueItems.length;
  useEffect(() => {
    const update = () => {
      const width = viewportRef.current?.clientWidth || 0;
      const cardWidth = trackRef.current?.firstElementChild?.getBoundingClientRect().width || 158;
      setVisible(Math.max(1, Math.min(count || 1, Math.floor((width + 12) / (cardWidth + 12)))));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [count]);
  useEffect(() => { setIndex(count > visible ? 1 : 0); setTransition(true); }, [items, count, visible]);
  const move = (direction) => {
    if (count <= visible) return;
    setTransition(true);
    setIndex((current) => current + direction);
  };
  const onTransitionEnd = () => {
    if (count <= visible) return;
    if (index >= count + 1 || index <= 0) {
      setTransition(false);
      setIndex(index >= count + 1 ? 1 : count);
      requestAnimationFrame(() => requestAnimationFrame(() => setTransition(true)));
    }
  };
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    dragStartRef.current = { x: event.clientX, pointerId: event.pointerId };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerUp = (event) => {
    const start = dragStartRef.current;
    if (!start) return;
    const distance = event.clientX - start.x;
    if (Math.abs(distance) > 35) {
      suppressClickRef.current = true;
      move(distance < 0 ? 1 : -1);
    }
    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture?.(start.pointerId);
  };
  const displayItems = count > visible ? [uniqueItems[count - 1], ...uniqueItems, ...uniqueItems.slice(0, visible)] : uniqueItems;
  return <div className="carousel-shell">
    {count > visible && <button className="carousel-arrow carousel-prev" onClick={() => move(-1)} aria-label="Show previous titles">‹</button>}
    <div className="poster-viewport" ref={viewportRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { dragStartRef.current = null; }}>
      <div className="poster-grid poster-carousel" ref={trackRef} onTransitionEnd={onTransitionEnd} style={{ "--carousel-index": index, transition: transition ? undefined : "none" }}>
      {displayItems.map((x, itemIndex) => <article className={`poster-card ${mode === "favorite" && liked(x) ? "is-picked" : ""}`} key={`${key(x)}-${itemIndex}`}>
        <button className="poster-open" onClick={(event) => { if (suppressClickRef.current) { event.preventDefault(); suppressClickRef.current = false; return; } if (mode === "favorite") favorite(x); else check(x); }} aria-label={mode === "favorite" ? `${liked(x) ? "Remove" : "Select"} ${x.title}` : `See match details for ${x.title}`}>
          <Poster x={x} />
          {mode === "favorite" && <span className="poster-check">{liked(x) ? "✓" : "+"}</span>}
          {mode !== "favorite" && x.category && <span className={`poster-match ${categoryClass(x.category)}`}>{x.category}</span>}
        </button>
        <div className="card-details"><strong title={x.title}>{x.title}</strong><span>{x.year || (x.type === "tv" ? "TV" : "Movie")}</span>{mode !== "favorite" && x.category && <span className={`category-badge ${categoryClass(x.category)}`}>{x.category}</span>}</div>
      </article>)}
      </div>
    </div>
    {count > visible && <button className="carousel-arrow carousel-next" onClick={() => move(1)} aria-label="Show next titles">›</button>}
  </div>;
}

function App() {
  const [page, P] = useState("welcome");
  const [taste, T] = useState(read);
  const [q, Q] = useState("");
  const [results, R] = useState([]);
  const [libraryRows, LR] = useState([]);
  const [recommendationRows, RR] = useState([]);
  const [selected, S] = useState(null);
  const [match, M] = useState(null);
  const [busy, B] = useState(false);
  const [searchBusy, SB] = useState(false);
  const [libraryBusy, LB] = useState(false);
  const [error, E] = useState("");
  const [pageNum, N] = useState(1);
  const [showHistory, SH] = useState(false);
  const initialFavorites = useRef(read().favorites.length > 0);
  const autoRequested = useRef(false);

  useEffect(() => localStorage.setItem(STORE, JSON.stringify(taste)), [taste]);
  useEffect(() => {
    if (initialFavorites.current) P("discover");
    LB(true);
    api("/api/discovery").then((d) => LR(d.rows || [])).catch((e) => E(e.message)).finally(() => LB(false));
  }, []);
  useEffect(() => {
    if (page === "discover" && taste.favorites.length && !recommendationRows.length && !autoRequested.current) { autoRequested.current = true; recommend(); }
  }, [page, taste.favorites.length]);
  useEffect(() => {
    if (q.trim().length < 2) { R([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      SB(true);
      api(`/api/search?query=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then((d) => { R(Array.isArray(d) ? d : []); E(""); }).catch((e) => { if (e.name !== "AbortError") E(e.message); }).finally(() => { if (!ctrl.signal.aborted) SB(false); });
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  const favorite = (x) => T((t) => ({ ...t, favorites: t.favorites.some((f) => key(f) === key(x)) ? t.favorites.filter((f) => key(f) !== key(x)) : [...t.favorites, x] }));
  const liked = (x) => taste.favorites.some((f) => key(f) === key(x));
  const feedback = (x, value) => T((t) => { const updated = { ...t.feedback }; if (updated[key(x)]?.value === value) delete updated[key(x)]; else updated[key(x)] = { ...x, value }; return { ...t, feedback: updated }; });
  const payload = () => ({ favorites: taste.favorites, feedback: Object.values(taste.feedback), preferences: taste.preferences || {} });
  const setPreference = (id, value) => T((t) => ({ ...t, preferences: { ...(t.preferences || {}), [id]: value } }));

  async function recommend() {
    if (busy) return;
    if (!taste.favorites.length) { P("onboard"); E("Pick a movie to continue."); return; }
    B(true); E("");
    try {
      const d = await post("/api/recommend", { ...payload(), exclude: taste.history, page: pageNum });
      const usedTitles = new Set();
      const rows = (Array.isArray(d.rows) ? d.rows : []).map((row) => ({
        ...row,
        items: (row.items || []).filter((item) => {
          const normalized = titleKey(item);
          if (!normalized || usedTitles.has(normalized)) return false;
          usedTitles.add(normalized);
          return true;
        }),
      })).filter((row) => row.items.length);
      RR(rows);
      const flat = rows.flatMap((row) => row.items || []);
      T((t) => ({ ...t, history: [...t.history.filter((k) => !flat.some((x) => key(x) === k)), ...flat.map(key)].slice(-250) }));
      N((n) => (n >= 29 ? 1 : n + 2));
    } catch (e) { E(e.message); } finally { B(false); }
  }

  async function check(x) {
    S(x); M({ category: null, reason: "" }); P("check"); Q(""); E(""); B(true);
    try {
      const response = await fetch("/api/match/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(), title: x }) });
      if (!response.ok) { const d = await response.json(); throw Error(d.error || "Match analysis failed."); }
      if (!response.body) throw Error("Streaming is not supported by this browser.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (block) => {
        const event = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
        const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) return;
        const data = JSON.parse(dataLine.slice(5).trim());
        if (event === "category") M((current) => ({ ...current, category: data.category }));
        if (event === "delta") M((current) => ({ ...current, reason: `${current?.reason || ""}${data.text}` }));
        if (event === "error") throw Error(data.error || "Match analysis failed.");
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";
        blocks.forEach(consume);
        if (done) break;
      }
      if (buffer.trim()) consume(buffer);
    } catch (e) { E(e.message); } finally { B(false); }
  }

  const cards = (items, mode = "favorite") => <Carousel items={items} mode={mode} liked={liked} favorite={favorite} check={check} />;
  const search = <label className="search"><span aria-hidden="true">⌕</span><input value={q} onChange={(e) => Q(e.target.value)} placeholder="Search real movies & TV shows…" aria-label="Search movies and TV shows" />{searchBusy && <span className="muted">Searching…</span>}</label>;
  const backToFavorites = () => { P("onboard"); Q(""); E(""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <div className="app">
    <header className="header"><button className="brand" onClick={() => { P("welcome"); Q(""); E(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>reel<span>match.</span></button><nav aria-label="Main navigation"><button className={page === "discover" ? "current" : ""} onClick={() => { P(taste.favorites.length ? "discover" : "onboard"); E(""); }}>Discover</button><button className={page === "taste" ? "current" : ""} onClick={() => { P("taste"); E(""); }}>My Taste</button></nav></header>
    <main>
      {page === "welcome" && <section className="hero"><div className="hero-content"><div className="hero-kicker">REELMATCH</div><h1>Movie night,<br /><em>solved.</em></h1><p>Movies you'll actually love.</p><button className="primary hero-button" onClick={() => { P("onboard"); E(""); }}>Get Started <span>→</span></button></div></section>}
      {page === "onboard" && <section className="section onboarding"><div className="step-label">STEP 1 OF 2</div><h1>Pick movies you <em>love.</em></h1><p>Tap any titles you already love. You can come back and add more anytime.</p>{search}{error && <p className="error" role="alert">{error}</p>}{q.trim().length >= 2 ? <><div className="collection-heading"><h2>Search results</h2><span>{searchBusy ? "Searching…" : "Tap to select"}</span></div>{searchBusy && <p className="inline-loading" role="status">Searching for titles…</p>}{!searchBusy && cards(results)}</> : libraryBusy ? <p className="inline-loading" role="status">Loading title collections…</p> : libraryRows.map((row) => <section className="title-row" key={row.title}><div className="collection-heading"><h2>{row.title}</h2><span>Use the arrows or swipe →</span></div>{cards(row.items || [])}</section>)}<div className="sticky-next"><span><strong>{taste.favorites.length}</strong> selected{taste.favorites.length > 0 && <small> — {taste.favorites.slice(-2).map((x) => x.title).join(", ")}{taste.favorites.length > 2 ? "…" : ""}</small>}</span><button className="primary" disabled={!taste.favorites.length} onClick={() => { autoRequested.current = false; P("discover"); RR([]); Q(""); E(""); }}>Find My Movies <span>→</span></button></div></section>}
      {page === "discover" && <section className="section discover"><div className="section-top"><div><div className="step-label">STEP 2 OF 2 · CURATED FOR YOU</div><h1>Your next <em>favorite.</em></h1></div><div className="section-actions"><button className="secondary add-favorites" onClick={backToFavorites}>← Add more favorites</button><button className="primary refresh" disabled={busy} onClick={recommend}>{busy ? "Finding…" : "↻ New picks"}</button></div></div>{error && <p className="error" role="alert">{error}</p>}{busy && <div className="finding-state" role="status"><span className="screen-loading-spinner" /> <strong>Finding your movies…</strong><small>Give us a sec — we’re matching your taste.</small></div>}{recommendationRows.length ? recommendationRows.map((row) => <section className="title-row" key={row.title}><div className="collection-heading"><h2>{row.title}</h2><span>AI-ranked for you · Use the arrows or swipe</span></div>{cards(row.items || [], "feedback")}</section>) : !busy && <div className="empty"><p>Your next movie is one click away.</p><button className="primary" onClick={recommend}>Find movies →</button></div>}<div className="discover-bottom"><button className="secondary" onClick={() => { Q(""); E(""); P("check"); }}>Search any movie ↗</button></div></section>}
      {page === "check" && <section className="section"><div className="step-label">MATCH DETAILS</div><h1>Find a <em>movie.</em></h1><p>Search any title to see how it fits your taste.</p>{search}{error && <p className="error" role="alert">{error}</p>}{selected && <div className="selected-title"><Poster x={selected} /><div><div className="eyebrow">AI MATCH ANALYSIS</div><h2>{selected.title} <span className="muted">{selected.year}</span></h2>{busy && !match?.reason ? <p>Analyzing your taste…</p> : match ? <><h3 className={`category-badge analysis-category ${categoryClass(match.category)}`}>{match.category || "Reading the vibe…"}</h3><div className="chat-bubble"><span className="chat-avatar">rm</span><p>{match.reason || "Okayyy, checking the vibe…"}<span className="typing-cursor" /></p></div></> : <p>Select a title to check your match.</p>}<div className="detail-actions"><button className={`secondary ${liked(selected) ? "active-control" : ""}`} onClick={() => favorite(selected)}>{liked(selected) ? "✓ Favorite" : "+ Add favorite"}</button>{[["love", "Loved It"], ["watch", "Want to Watch"], ["seen", "Already Seen"], ["no", "Not for Me"]].map(([value, label]) => <button key={value} className={`reaction-control ${taste.feedback[key(selected)]?.value === value ? "active" : ""}`} onClick={() => feedback(selected, value)}>{label}</button>)}</div></div></div>}{q.trim().length >= 2 && <>{searchBusy && <p className="inline-loading">Searching for titles…</p>}{!searchBusy && cards(results, "check")}</>}</section>}
      {page === "taste" && <section className="section"><div className="step-label">YOUR COLLECTION</div><h1>My <em>Taste.</em></h1><p>Your favorites, all in one place.</p><div className="taste-actions"><button className="secondary" onClick={() => P("onboard")}>+ Add favorites</button><button className="secondary subtle-control" onClick={() => SH((v) => !v)}>{showHistory ? "Hide" : "Show"} discovery history ({taste.history.length})</button></div><details className="taste-settings"><summary>Preferences</summary><div className="preference-panel">{QUESTIONS.map((question) => <div className="preference-question" key={question.id}><h2>{question.title}</h2><div className="preference-options">{question.options.map((option) => <button key={option} className={(taste.preferences || {})[question.id] === option ? "preference-choice chosen" : "preference-choice"} aria-pressed={(taste.preferences || {})[question.id] === option} onClick={() => setPreference(question.id, option)}>{option}</button>)}</div></div>)}</div></details>{showHistory && <div className="history-note">ReelMatch remembers {taste.history.length} recently recommended titles in this browser. <button className="small-button" onClick={() => { if (window.confirm("Clear recommendation history? Your favorites and reactions will stay saved.")) T((t) => ({ ...t, history: [] })); }}>Clear history</button></div>}<h2 className="collection-title">Favorites</h2>{taste.favorites.length ? cards(taste.favorites) : <div className="empty">No favorites yet. Add a few titles to start shaping your taste.</div>}{[["love", "Loved It"], ["watch", "Want to Watch"], ["seen", "Already Seen"], ["no", "Not for Me"]].map(([v, label]) => { const items = Object.values(taste.feedback).filter((x) => x.value === v); return items.length ? <section className="taste-group" key={v}><h2 className="collection-title">{label} <span className="muted">({items.length})</span></h2><div className="taste-list">{items.map((x) => <div className="taste-row" key={key(x)}><button className="taste-poster" onClick={() => check(x)} aria-label={`Check ${x.title}`}><Poster x={x} /></button><div className="taste-row-info"><strong>{x.title}</strong><span className="muted">{x.year || "Unknown year"} · {x.type === "tv" ? "TV" : "Movie"}</span></div><button className="small-button" onClick={() => feedback(x, v)}>Remove</button></div>)}</div></section> : null; })}</section>}
    </main><footer><div><strong>reel<span>match.</span></strong><p>Made for the indecisive movie lover.</p></div><div className="attribution"><img src="/tmdb-logo.svg" alt="TMDB logo" /><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div></footer>
  </div>;
}
createRoot(document.getElementById("root")).render(<App />);
