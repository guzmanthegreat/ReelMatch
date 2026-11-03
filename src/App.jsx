import { useState, useEffect, useRef } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

import { auth, googleProvider, db } from "./firebase";

import { doc, getDoc, setDoc } from "firebase/firestore";
import "./App.css";

const questions = [
  {
    question: "What kind of pacing do you enjoy?",
    options: [
      "Fast-paced action",
      "Slow-building stories",
      "A balance of both",
    ],
  },
  {
    question: "What makes a story memorable to you?",
    options: [
      "Plot twists",
      "Emotional depth",
      "Complex characters",
      "World-building",
    ],
  },
  {
    question: "What atmosphere do you typically enjoy?",
    options: [
      "Dark and intense",
      "Lighthearted",
      "Thought-provoking",
      "Adventurous",
    ],
  },
];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function App() {
  const [page, setPage] = useState("home");
  const [favorites, setFavorites] = useState([]);
  const [movieInput, setMovieInput] = useState("");

  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [answers, setAnswers] = useState(["", "", ""]);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [matchQuery, setMatchQuery] = useState("");
  const [matchResults, setMatchResults] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState("");

  const matchCache = useRef(new Map());

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      setProfileLoading(true);
      setProfileError("");

      // Clear data from any previous user.
      setFavorites([]);
      setAnswers(["", "", ""]);
      setPage("home");

      if (!currentUser) {
        setProfileLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, "users", currentUser.uid);
        const snapshot = await getDoc(profileRef);

        if (!active || auth.currentUser?.uid !== currentUser.uid) {
          return;
        }

        if (snapshot.exists()) {
          const profile = snapshot.data();

          setFavorites(
            Array.isArray(profile.favorites) ? profile.favorites : [],
          );

          setAnswers(
            Array.isArray(profile.answers) && profile.answers.length === 3
              ? profile.answers
              : ["", "", ""],
          );

          setPage("profile");
        }
      } catch (error) {
        if (active) {
          console.error("Profile loading error:", error.code);
          setProfileError("Could not load your saved profile.");
        }
      } finally {
        if (active && auth.currentUser?.uid === currentUser.uid) {
          setProfileLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function handleGoogleSignIn() {
    setAuthError("");

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google sign-in error:", error.code);
      setAuthError("Google sign-in failed. Please try again.");
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      setPage("home");
    } catch (error) {
      console.error("Sign-out error:", error.code);
      setAuthError("Could not sign out. Please try again.");
    }
  }

  async function saveProfile() {
    if (!user) {
      setProfileError("Please sign in with Google first.");
      return;
    }

    if (favorites.length !== 3 || !allQuestionsAnswered) {
      return;
    }

    setProfileSaving(true);
    setProfileError("");

    try {
      const profileRef = doc(db, "users", user.uid);

      await setDoc(profileRef, {
        favorites: favorites,
        answers: answers,
        updatedAt: new Date().toISOString(),
      });

      setPage("profile");
    } catch (error) {
      console.error("Profile saving error:", error.code);
      setProfileError("Could not save your profile. Try again.");
    } finally {
      setProfileSaving(false);
    }
  }

  function addMovie(movie) {
    if (favorites.length >= 3) {
      return;
    }

    const alreadyAdded = favorites.some(
      (favorite) => favorite.id === movie.id && favorite.type === movie.type,
    );

    if (alreadyAdded) {
      return;
    }

    setFavorites([...favorites, movie]);
    setMovieInput("");
    setSearchResults([]);
    setSearchError("");
  }

  function removeMovie(movieToRemove) {
    setFavorites(
      favorites.filter(
        (movie) =>
          !(movie.id === movieToRemove.id && movie.type === movieToRemove.type),
      ),
    );
  }

  async function searchMovies(event) {
    event.preventDefault();

    const query = movieInput.trim();

    if (!query) {
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      const response = await fetch(
        `${API_URL}/api/search?query=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error("Movie search failed");
      }

      const data = await response.json();

      setSearchResults(data);
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setIsSearching(false);
    }
  }

  async function searchForMatch(event) {
    event.preventDefault();

    const query = matchQuery.trim();

    if (!query) return;

    setMatchError("");
    setMatchResults([]);
    setSelectedMatch(null);
    setMatchData(null);
    setShowDetails(false);

    try {
      const response = await fetch(
        `${API_URL}/api/search?query=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error("Could not search for movies.");
      }

      const results = await response.json();
      setMatchResults(results);
    } catch (error) {
      setMatchError(error.message);
    }
  }

  async function analyzeMatch() {
    if (!selectedMatch || matchLoading || !user) return;

    if (favorites.length !== 3 || answers.some((a) => !a)) {
      setMatchError("Complete your taste profile first.");
      return;
    }

    // Identify the movie AND the current taste profile.
    const profileKey = JSON.stringify({
      userId: user.uid,
      favorites: favorites.map((movie) => ({
        id: movie.id,
        type: movie.type,
      })),
      answers,
    });

    const cacheKey = JSON.stringify({
      movieId: selectedMatch.id,
      movieType: selectedMatch.type,
      profile: profileKey,
    });

    // Reuse a previous prediction if one exists.
    if (matchCache.current.has(cacheKey)) {
      setMatchData(matchCache.current.get(cacheKey));
      setMatchError("");
      setShowDetails(false);
      return;
    }

    setMatchLoading(true);
    setMatchError("");
    setMatchData(null);
    setShowDetails(false);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("${API_URL}/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          movie: {
            id: selectedMatch.id,
            type: selectedMatch.type,
          },
          favorites,
          answers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI analysis failed.");
      }

      // Save successful predictions in memory.
      matchCache.current.set(cacheKey, data);

      setMatchData(data);
    } catch (error) {
      setMatchError(error.message);
    } finally {
      setMatchLoading(false);
    }
  }

  async function discoverMovies() {
    if (discoverLoading || favorites.length !== 3) {
      return;
    }

    setDiscoverLoading(true);
    setDiscoverError("");

    try {
      const response = await fetch("${API_URL}/api/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ favorites }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load recommendations.");
      }

      setRecommendations(data);
    } catch (error) {
      setDiscoverError(error.message);
    } finally {
      setDiscoverLoading(false);
    }
  }

  function updateAnswer(questionIndex, selectedOption) {
    const updatedAnswers = [...answers];

    updatedAnswers[questionIndex] = selectedOption;

    setAnswers(updatedAnswers);
  }

  const allQuestionsAnswered = answers.every((answer) => answer !== "");

  return (
    <div className="app">
      <nav className="navbar">
        <div className="logo">
          Reel<span>Match</span>
        </div>

        <div className="auth-controls">
          {authLoading ? (
            <span>Checking login...</span>
          ) : user ? (
            <>
              <span className="user-name">
                {user.displayName || user.email}
              </span>

              <button className="auth-button" onClick={handleSignOut}>
                Sign Out
              </button>
            </>
          ) : (
            <button className="auth-button" onClick={handleGoogleSignIn}>
              Continue with Google
            </button>
          )}
        </div>
      </nav>

      {authError && (
        <p className="auth-error" role="alert">
          {authError}
        </p>
      )}

      {profileLoading && user && (
        <p className="profile-notice">Loading your saved profile...</p>
      )}

      {profileError && (
        <p className="auth-error" role="alert">
          {profileError}
        </p>
      )}

      {page === "home" && (
        <main className="hero">
          <div className="eyebrow">YOUR PERSONAL AI MOVIE ADVISOR</div>

          <h1>Your next favorite movie is waiting.</h1>

          <p>
            Discover movies and TV shows that match your unique taste. No more
            endless scrolling.
          </p>

          <button
            disabled={authLoading || profileLoading}
            className="get-started"
            onClick={() => {
              if (!authLoading && !profileLoading) {
                setPage("favorites");
              }
            }}
          >
            Get Started →
          </button>

          <div className="features">
            <span>✦ AI-powered matches</span>
            <span>♡ Personalized for you</span>
          </div>
        </main>
      )}

      {page === "favorites" && (
        <main className="hero">
          <div className="eyebrow">STEP 1 OF 2</div>

          <h1>Let's discover your taste.</h1>

          <p>Choose three movies or TV shows you absolutely love.</p>

          <div className="movie-picker">
            <p>{favorites.length} of 3 selected</p>

            {favorites.map((movie) => (
              <div className="movie-item" key={`${movie.type}-${movie.id}`}>
                <div className="favorite-info">
                  {movie.poster ? (
                    <img src={movie.poster} alt={`${movie.title} poster`} />
                  ) : (
                    <div className="favorite-no-poster">No poster</div>
                  )}

                  <div className="favorite-details">
                    <strong>{movie.title}</strong>

                    <span>
                      {movie.releaseDate?.slice(0, 4) || "Unknown year"}
                      {" · "}
                      {movie.type === "movie" ? "Movie" : "TV Show"}
                    </span>
                  </div>
                </div>

                <button type="button" onClick={() => removeMovie(movie)}>
                  Remove
                </button>
              </div>
            ))}

            {favorites.length < 3 && (
              <div>
                <form onSubmit={searchMovies}>
                  <input
                    type="text"
                    placeholder="Search for a movie or TV show"
                    value={movieInput}
                    onChange={(event) => setMovieInput(event.target.value)}
                  />

                  <button type="submit" disabled={isSearching}>
                    {isSearching ? "Searching..." : "Search"}
                  </button>
                </form>

                {searchError && <p className="search-error">{searchError}</p>}

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((movie) => (
                      <button
                        type="button"
                        className="search-result"
                        key={`${movie.type}-${movie.id}`}
                        onClick={() => addMovie(movie)}
                      >
                        {movie.poster ? (
                          <img
                            src={movie.poster}
                            alt={`${movie.title} poster`}
                          />
                        ) : (
                          <div className="no-poster">No poster</div>
                        )}

                        <div className="search-result-info">
                          <strong>{movie.title}</strong>

                          <span>
                            {movie.releaseDate?.slice(0, 4) || "Unknown year"}
                            {" · "}
                            {movie.type === "movie" ? "Movie" : "TV Show"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!isSearching &&
                  searchResults.length === 0 &&
                  !searchError &&
                  movieInput.trim() && (
                    <p className="search-hint">
                      Press Search to find matching titles.
                    </p>
                  )}
              </div>
            )}

            <button
              className="get-started"
              disabled={favorites.length !== 3}
              onClick={() => setPage("questions")}
            >
              Continue →
            </button>
          </div>

          <button className="back-button" onClick={() => setPage("home")}>
            ← Back
          </button>
        </main>
      )}

      {page === "questions" && (
        <main className="hero">
          <div className="eyebrow">STEP 2 OF 2</div>

          <h1>Tell us what you enjoy.</h1>

          <p>
            These questions help ReelMatch understand your personal viewing
            preferences.
          </p>

          <div className="questionnaire">
            {questions.map((item, questionIndex) => (
              <div className="question-card" key={questionIndex}>
                <h3>{item.question}</h3>

                <div className="answer-options">
                  {item.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={
                        answers[questionIndex] === option
                          ? "answer selected"
                          : "answer"
                      }
                      onClick={() => updateAnswer(questionIndex, option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              className="get-started"
              disabled={!allQuestionsAnswered || profileSaving || !user}
              onClick={saveProfile}
            >
              {profileSaving ? "Saving..." : "Finish Setup →"}
            </button>

            {!user && (
              <p className="profile-notice">
                Sign in with Google to save your taste profile.
              </p>
            )}
          </div>

          <button className="back-button" onClick={() => setPage("favorites")}>
            ← Back
          </button>
        </main>
      )}

      {page === "profile" && (
        <main className="hero">
          <div className="eyebrow">YOUR TASTE PROFILE</div>

          <h1>Your ReelMatch profile is ready.</h1>

          <p>Your preferences are saved to your Google account.</p>

          <div className="profile-summary">
            <h2>Your favorite movies</h2>

            {favorites.map((movie) => (
              <p key={`${movie.type}-${movie.id}`}>♥ {movie.title}</p>
            ))}

            <h2>Your preferences</h2>

            {questions.map((item, index) => (
              <div key={index}>
                <h3>{item.question}</h3>
                <p>{answers[index]}</p>
              </div>
            ))}
          </div>

          <button className="get-started" onClick={() => setPage("discover")}>
            Find My Next Watch →
          </button>

          <button className="back-button" onClick={() => setPage("questions")}>
            ← Edit Preferences
          </button>
        </main>
      )}

      {page === "discover" && (
        <main className="hero">
          <div className="eyebrow">YOUR PERSONAL MOVIE ADVISOR</div>

          <h1>Will you love it?</h1>

          <div className="discovery-actions">
            <button
              className="get-started"
              onClick={discoverMovies}
              disabled={discoverLoading}
            >
              {discoverLoading
                ? "Finding recommendations..."
                : "✦ Discover For Me"}
            </button>
          </div>

          <p>
            Search for a movie or TV show to discover how well it matches your
            taste.
          </p>

          <div className="movie-picker">
            <form onSubmit={searchForMatch}>
              <input
                type="text"
                placeholder="Search for a movie or TV show"
                value={matchQuery}
                onChange={(event) => setMatchQuery(event.target.value)}
              />

              <button type="submit">Search</button>
            </form>

            {matchResults.length > 0 && (
              <div className="search-results">
                {matchResults.map((movie) => (
                  <button
                    type="button"
                    className="search-result"
                    key={`${movie.type}-${movie.id}`}
                    onClick={() => {
                      setSelectedMatch(movie);
                      setMatchResults([]);
                      setMatchData(null);
                      setMatchError("");
                    }}
                  >
                    {movie.poster ? (
                      <img src={movie.poster} alt={`${movie.title} poster`} />
                    ) : (
                      <div className="no-poster">No poster</div>
                    )}

                    <div className="search-result-info">
                      <strong>{movie.title}</strong>

                      <span>
                        {movie.releaseDate?.slice(0, 4) || "Unknown year"}
                        {" · "}
                        {movie.type === "movie" ? "Movie" : "TV Show"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedMatch && (
              <div className="selected-match">
                <h2>{selectedMatch.title}</h2>

                <p>{selectedMatch.type === "movie" ? "Movie" : "TV Show"}</p>

                <button
                  className="get-started"
                  onClick={analyzeMatch}
                  disabled={matchLoading}
                >
                  {matchLoading
                    ? "Analyzing your taste..."
                    : "Analyze My Match ✦"}
                </button>
              </div>
            )}

            {matchError && (
              <p className="search-error" role="alert">
                {matchError}
              </p>
            )}

            {matchData && (
              <div className="match-card">
                <div className="match-category">✦ {matchData.category}</div>

                <h2>{matchData.movie.title}</h2>

                <p>{matchData.shortExplanation}</p>

                <button
                  className="details-button"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails
                    ? "Hide Detailed Analysis"
                    : "View Detailed Analysis"}
                </button>

                {showDetails && (
                  <div className="match-details">
                    <h3>Why this matches your taste</h3>
                    <p>{matchData.detailedExplanation}</p>

                    <h3>Potential drawback</h3>
                    <p>{matchData.potentialDrawback}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {discoverError && (
            <p className="search-error" role="alert">
              {discoverError}
            </p>
          )}

          {recommendations.length > 0 && (
            <section className="recommendations-section">
              <h2>Recommended For You</h2>

              <p>
                Explore titles related to your favorites. Select one to check
                your personal match.
              </p>

              <div className="recommendations-grid">
                {recommendations.map((movie) => (
                  <div
                    className="recommendation-card"
                    key={`${movie.type}-${movie.id}`}
                  >
                    {movie.poster ? (
                      <img src={movie.poster} alt={`${movie.title} poster`} />
                    ) : (
                      <div className="recommendation-placeholder">
                        No poster available
                      </div>
                    )}

                    <div className="recommendation-info">
                      <h3>{movie.title}</h3>

                      <span>
                        {movie.releaseDate?.slice(0, 4) || "Unknown year"}
                        {" · "}
                        {movie.type === "movie" ? "Movie" : "TV Show"}
                      </span>

                      <p>
                        {movie.overview
                          ? `${movie.overview.slice(0, 110)}...`
                          : "No description available."}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMatch(movie);
                          setMatchResults([]);
                          setMatchData(null);
                          setMatchError("");
                          setShowDetails(false);

                          window.scrollTo({
                            top: 0,
                            behavior: "smooth",
                          });
                        }}
                      >
                        Check My Match →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button className="back-button" onClick={() => setPage("profile")}>
            ← Back to Profile
          </button>
        </main>
      )}
    </div>
  );
}

export default App;
