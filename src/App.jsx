/* oxlint-disable react/only-export-components */
import React, { useEffect, useRef, useState } from "react";

// These keys identify the user's saved taste and current browser session.
const TASTE_STORAGE_KEY = "reelmatch:taste";
const SESSION_STARTED_KEY = "reelmatch:session-started";

// These optional answers help personalize recommendations.
const PREFERENCE_QUESTIONS = [
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

// Creates the starting taste data before the user picks any titles.
function createEmptyTaste() {
  return { favorites: [], feedback: {}, history: [], preferences: {} };
}
// Loads saved taste from browser storage, or starts fresh if it is unavailable.
function loadTaste() {
  try {
    if (!sessionStorage.getItem(SESSION_STARTED_KEY)) {
      // Start this browser session without the taste saved by an earlier one.
      sessionStorage.setItem(SESSION_STARTED_KEY, "1");
      localStorage.removeItem(TASTE_STORAGE_KEY);
    }
    const savedTasteText = localStorage.getItem(TASTE_STORAGE_KEY);
    if (!savedTasteText) {
      return createEmptyTaste();
    }

    // Saved taste is JSON text, so parse it back into JavaScript data.
    const savedTaste = JSON.parse(savedTasteText);
    if (savedTaste) {
      return savedTaste;
    }

    return createEmptyTaste();
  } catch {
    // Browser settings can block storage, so use an empty taste if it fails.
    return createEmptyTaste();
  }
}
// Sends a request and returns its JSON response.
async function requestJson(url, options) {
  const response = await fetch(url, options);
  const responseText = await response.text();
  let responseData = {};
  try {
    // Convert the response text to JavaScript data; an empty response becomes an empty object.
    if (responseText) {
      responseData = JSON.parse(responseText);
    } else {
      responseData = {};
    }
  } catch {
    // Keep an empty object if the response is not valid JSON.
    responseData = {};
  }
  // Throwing here sends the error to the calling function's catch block.
  if (!response.ok) {
    if (responseData && responseData.error) {
      throw Error(responseData.error);
    }
    throw Error(`Request failed (${response.status})`);
  }
  return responseData;
}
// Sends JSON data to a server route.
function postJson(url, requestData) {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The server expects the request data as JSON text.
    body: JSON.stringify(requestData),
  };
  return requestJson(url, options);
}

import {
  key as getTitleId,
  titleKey as normalizeTitleName,
  categoryClass,
} from "./utils";
import { Carousel } from "./components/Carousel";
import WelcomeScreen from "./screens/WelcomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import DiscoverScreen from "./screens/DiscoverScreen";
import MatchScreen from "./screens/MatchScreen";
import TasteScreen from "./screens/TasteScreen";

export default function App() {
  // Shared app state connects the screens and tracks the user's progress.
  // Each useState call gives us a value and a function that updates that value.
  const [page, setPage] = useState("welcome");
  const [taste, setTaste] = useState(loadTaste);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [libraryRows, setLibraryRows] = useState([]);
  const [recommendationRows, setRecommendationRows] = useState([]);
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [matchAnalysis, setMatchAnalysis] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isSearchBusy, setIsSearchBusy] = useState(false);
  const [isLibraryBusy, setIsLibraryBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [recommendationPage, setRecommendationPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [pageToReturnTo, setPageToReturnTo] = useState("discover");
  // These refs keep values between renders without causing another render.
  const hasSavedFavorites = useRef(loadTaste().favorites.length > 0);
  const hasAutoRequestedRecommendations = useRef(false);
  const searchRequestIdRef = useRef(0);
  const matchRequestControllerRef = useRef(null);
  // Allows recommendations to be requested again after favorites change.
  const resetAutomaticRecommendationRequest = () => {
    hasAutoRequestedRecommendations.current = false;
  };

  // Saves taste changes in browser storage after each update.
  // Web storage accepts text, so convert the taste object to JSON first.
  useEffect(
    () => localStorage.setItem(TASTE_STORAGE_KEY, JSON.stringify(taste)),
    [taste],
  );
  useEffect(() => {
    // Loads general discovery collections when the app starts.
    if (hasSavedFavorites.current) setPage("discover");
    // Shows a loading state while the discovery request runs.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsLibraryBusy(true);

    async function loadDiscoveryRows() {
      try {
        // Load the shared collections used during onboarding.
        const responseData = await requestJson("/api/discovery");
        if (Array.isArray(responseData.rows)) {
          setLibraryRows(responseData.rows);
        } else {
          setLibraryRows([]);
        }
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLibraryBusy(false);
      }
    }

    loadDiscoveryRows();
  }, []);
  useEffect(() => {
    // Skips onboarding and requests recommendations when saved favorites exist.
    if (
      page === "discover" &&
      taste.favorites.length &&
      !recommendationRows.length &&
      !hasAutoRequestedRecommendations.current
    ) {
      // Prevent this effect from requesting the same automatic batch again.
      hasAutoRequestedRecommendations.current = true;
      requestRecommendations();
    }
    // Rechecks when the page or number of favorites changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [page, taste.favorites.length]);
  useEffect(() => {
    // Adds a back button to secondary screens without shifting the page layout.
    if (page === "welcome" || page === "discover") {
      return undefined;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-back";
    button.textContent = "← Back";
    // Returns to the screen that makes sense for the current page.
    const goBack = () => {
      if (page === "onboarding") setPage("welcome");
      else if (page === "match") setPage(pageToReturnTo);
      else if (page === "taste") {
        if (taste.favorites.length > 0) {
          setPage("discover");
        } else {
          setPage("welcome");
        }
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    button.addEventListener("click", goBack);
    // Add the button outside the page layout so it does not move the content.
    document.body.appendChild(button);
    return () => {
      // Remove the button and listener before this effect runs again.
      button.removeEventListener("click", goBack);
      button.remove();
    };
  }, [page, pageToReturnTo, taste.favorites.length]);
  useEffect(() => {
    // Waits briefly before searching and cancels older searches as the query changes.
    // The request ID prevents an older response from replacing newer results.
    const requestId = ++searchRequestIdRef.current;
    if (searchQuery.trim().length < 2) {
      // Only search after the user has entered at least two characters.
      // oxlint-disable-next-line react/set-state-in-effect
      setSearchResults([]);
      // oxlint-disable-next-line react/set-state-in-effect
      setIsSearchBusy(false);
      return;
    }
    const searchController = new AbortController();
    // Debounce the request so each keystroke does not trigger a search.
    const timer = setTimeout(async () => {
      setIsSearchBusy(true);
      // The URL contains the text the user entered, encoded for safe use in a URL.
      try {
        const responseData = await requestJson(
          `/api/search?query=${encodeURIComponent(searchQuery)}`,
          { signal: searchController.signal },
        );
        // Ignore this response if a newer search has started.
        if (requestId !== searchRequestIdRef.current) return;
        if (Array.isArray(responseData)) {
          setSearchResults(responseData);
        } else {
          setSearchResults([]);
        }
        setErrorMessage("");
      } catch (error) {
        // Aborted searches are expected when the query changes.
        if (
          error.name !== "AbortError" &&
          requestId === searchRequestIdRef.current
        ) {
          setErrorMessage(error.message);
        }
      } finally {
        if (
          !searchController.signal.aborted &&
          requestId === searchRequestIdRef.current
        ) {
          setIsSearchBusy(false);
        }
      }
    }, 300);
    return () => {
      // Cancel both the pending timer and any search already in progress.
      clearTimeout(timer);
      searchController.abort();
    };
  }, [searchQuery]);

  // Adds a title to favorites, or removes it if it is already there.
  function toggleFavorite(title) {
    setTaste((currentTaste) => {
      const selectedTitleId = getTitleId(title);
      let isAlreadyFavorite = false;
      const updatedFavorites = [];

      // Check each favorite and copy only titles that should remain.
      for (const favoriteTitle of currentTaste.favorites) {
        if (getTitleId(favoriteTitle) === selectedTitleId) {
          isAlreadyFavorite = true;
        } else {
          updatedFavorites.push(favoriteTitle);
        }
      }

      if (!isAlreadyFavorite) {
        updatedFavorites.push(title);
      }

      // The three dots copy the current fields into a new object.
      // The favorites line below replaces only the old favorites list.
      return {
        ...currentTaste,
        favorites: updatedFavorites,
      };
    });
  }

  // Checks whether a title is already in the user's favorites.
  function isFavorite(title) {
    const selectedTitleId = getTitleId(title);
    for (const favoriteTitle of taste.favorites) {
      if (getTitleId(favoriteTitle) === selectedTitleId) {
        return true;
      }
    }
    return false;
  }

  // Saves a reaction, or removes it when the same reaction is selected again.
  function toggleFeedback(title, reaction) {
    setTaste((currentTaste) => {
      // Copy the saved reactions so the previous React state is not changed.
      const updatedFeedback = { ...currentTaste.feedback };
      const selectedTitleId = getTitleId(title);
      const savedReaction = updatedFeedback[selectedTitleId];

      if (savedReaction && savedReaction.value === reaction) {
        delete updatedFeedback[selectedTitleId];
      } else {
        // Copy the title's details and add the reaction the user selected.
        updatedFeedback[selectedTitleId] = { ...title, value: reaction };
      }

      return {
        ...currentTaste,
        feedback: updatedFeedback,
      };
    });
  }

  // Prepares the taste data sent with recommendation and match requests.
  function createTastePayload() {
    const feedbackItems = [];
    for (const titleId in taste.feedback) {
      feedbackItems.push(taste.feedback[titleId]);
    }

    let preferences = taste.preferences;
    if (!preferences) {
      preferences = {};
    }

    return {
      favorites: taste.favorites,
      feedback: feedbackItems,
      preferences: preferences,
    };
  }

  // Updates one preference without changing the others.
  function updatePreference(preferenceId, preferenceValue) {
    setTaste((currentTaste) => {
      const updatedPreferences = {};
      let savedPreferences = currentTaste.preferences;
      if (!savedPreferences) {
        savedPreferences = {};
      }

      // Copy the other choices before changing the selected preference.
      for (const savedPreferenceId in savedPreferences) {
        updatedPreferences[savedPreferenceId] =
          savedPreferences[savedPreferenceId];
      }
      updatedPreferences[preferenceId] = preferenceValue;

      return {
        ...currentTaste,
        preferences: updatedPreferences,
      };
    });
  }

  // Requests recommendations, removes duplicate titles, and saves their IDs in history.
  async function requestRecommendations() {
    // Ignore repeated clicks while the previous request is still running.
    if (isBusy) return;
    if (!taste.favorites.length) {
      // Favorites are required before the server can personalize results.
      setPage("onboarding");
      setErrorMessage("Pick a movie to continue.");
      return;
    }
    setIsBusy(true);
    setErrorMessage("");
    try {
      const requestData = createTastePayload();
      requestData.exclude = taste.history;
      requestData.page = recommendationPage;

      const responseData = await postJson("/api/recommend", requestData);
      const rows = [];
      const usedTitleNames = [];

      if (Array.isArray(responseData.rows)) {
        for (const recommendationRow of responseData.rows) {
          const uniqueTitles = [];

          // Avoid duplicate titles, including differences in letter case or spacing.
          let titlesInRow = recommendationRow.items;
          if (!Array.isArray(titlesInRow)) {
            titlesInRow = [];
          }

          for (const title of titlesInRow) {
            const normalizedName = normalizeTitleName(title);
            let nameAlreadyUsed = false;
            for (
              let nameIndex = 0;
              nameIndex < usedTitleNames.length;
              nameIndex += 1
            ) {
              if (usedTitleNames[nameIndex] === normalizedName) {
                nameAlreadyUsed = true;
                break;
              }
            }

            if (normalizedName && !nameAlreadyUsed) {
              usedTitleNames.push(normalizedName);
              uniqueTitles.push(title);
            }
          }

          if (uniqueTitles.length > 0) {
            // Copy the row details and replace its items with unique titles.
            rows.push({
              ...recommendationRow,
              items: uniqueTitles,
            });
          }
        }
      }

      setRecommendationRows(rows);
      const recommendedTitleIds = [];
      for (const recommendationRow of rows) {
        for (const title of recommendationRow.items) {
          recommendedTitleIds.push(getTitleId(title));
        }
      }

      setTaste((currentTaste) => {
        const updatedHistory = [];

        // Keep old history entries only if this batch did not show them again.
        for (const savedTitleId of currentTaste.history) {
          let wasRecommendedAgain = false;
          for (
            let titleIndex = 0;
            titleIndex < recommendedTitleIds.length;
            titleIndex += 1
          ) {
            if (recommendedTitleIds[titleIndex] === savedTitleId) {
              wasRecommendedAgain = true;
              break;
            }
          }

          if (!wasRecommendedAgain) {
            updatedHistory.push(savedTitleId);
          }
        }

        // Add this batch at the end so the newest titles are easiest to keep.
        for (const recommendedTitleId of recommendedTitleIds) {
          updatedHistory.push(recommendedTitleId);
        }

        // Keep only the 250 most recent title IDs.
        if (updatedHistory.length > 250) {
          updatedHistory.splice(0, updatedHistory.length - 250);
        }

        return {
          ...currentTaste,
          history: updatedHistory,
        };
      });

      // Move ahead by two pages for the next recommendation batch.
      setRecommendationPage((currentPage) => {
        if (currentPage >= 29) {
          return 1;
        }
        return currentPage + 2;
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  // Requests a title analysis and adds each streamed response to the page.
  async function analyzeTitleMatch(title) {
    // Cancels the previous analysis so its response cannot appear under this title.
    if (matchRequestControllerRef.current) {
      matchRequestControllerRef.current.abort();
    }

    const requestController = new AbortController();
    matchRequestControllerRef.current = requestController;
    // Remember where to return if the user opened match details from another screen.
    if (page === "match") {
      setPageToReturnTo("discover");
    } else {
      setPageToReturnTo(page);
    }

    let existingCategory = null;
    if (title.category) {
      existingCategory = title.category;
    }

    setSelectedTitle(title);
    setMatchAnalysis({ category: existingCategory, reason: "" });
    setPage("match");
    setSearchQuery("");
    setErrorMessage("");
    setIsBusy(true);
    try {
      const requestData = createTastePayload();
      requestData.title = title;

      const response = await fetch("/api/match/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the selected title and taste data used to create its analysis.
        body: JSON.stringify(requestData),
        signal: requestController.signal,
      });
      // Turn an HTTP failure into an error message for the screen.
      if (!response.ok) {
        const responseData = await response.json();
        if (responseData && responseData.error) {
          throw Error(responseData.error);
        }
        throw Error("Match analysis failed.");
      }
      if (!response.body)
        throw Error("Streaming is not supported by this browser.");
      // A reader provides each incoming piece of the server's streamed response.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // Network chunks may split an event, so keep incomplete text until the next chunk.
      let buffer = "";
      // Reads one server event and updates the category or explanation.
      const consumeStreamEvent = (eventBlock) => {
        const eventLines = eventBlock.split("\n");
        let eventType = "";
        let dataLine = "";

        for (const line of eventLines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          }
          if (line.startsWith("data:")) {
            dataLine = line;
          }
        }

        if (!dataLine) {
          return;
        }

        const eventData = JSON.parse(dataLine.slice(5).trim());
        // The server sends the category and explanation as separate event types.
        if (eventType === "category") {
          if (!existingCategory) {
            setMatchAnalysis((currentAnalysis) => {
              let currentReason = "";
              if (currentAnalysis && currentAnalysis.reason) {
                currentReason = currentAnalysis.reason;
              }
              return {
                category: eventData.category,
                reason: currentReason,
              };
            });
          }
        }

        // Add each new text piece to the explanation already on screen.
        if (eventType === "delta") {
          setMatchAnalysis((currentAnalysis) => {
            let currentReason = "";
            if (currentAnalysis && currentAnalysis.reason) {
              currentReason = currentAnalysis.reason;
            }
            let currentCategory = null;
            if (currentAnalysis) {
              currentCategory = currentAnalysis.category;
            }
            return {
              category: currentCategory,
              reason: currentReason + eventData.text,
            };
          });
        }

        if (eventType === "error") {
          if (eventData.error) {
            throw Error(eventData.error);
          }
          throw Error("Match analysis failed.");
        }
      };

      while (true) {
        const streamResult = await reader.read();
        const value = streamResult.value;
        const streamFinished = streamResult.done;
        // Decode bytes and add them to any event text left over from the last read.
        let decodedText = "";
        if (value) {
          decodedText = decoder.decode(value, { stream: !streamFinished });
        } else {
          decodedText = decoder.decode(new Uint8Array(), {
            stream: !streamFinished,
          });
        }
        buffer = buffer + decodedText;

        // Process complete events and leave any unfinished event in buffer.
        let separatorIndex = buffer.indexOf("\n\n");
        while (separatorIndex !== -1) {
          const completeEvent = buffer.slice(0, separatorIndex);
          consumeStreamEvent(completeEvent);
          buffer = buffer.slice(separatorIndex + 2);
          separatorIndex = buffer.indexOf("\n\n");
        }

        if (streamFinished) break;
      }

      // Process the final event if the stream ended without a trailing separator.
      if (buffer.trim()) {
        consumeStreamEvent(buffer);
      }
    } catch (error) {
      // Aborting a request is expected when another title is selected.
      if (error.name !== "AbortError") {
        setErrorMessage(error.message);
      }
    } finally {
      // Clear the request controller only if it still belongs to this request.
      if (matchRequestControllerRef.current === requestController) {
        matchRequestControllerRef.current = null;
      }
      setIsBusy(false);
    }
  }

  // Cancels an active match request if the app is removed from the page.
  useEffect(() => {
    return () => {
      if (matchRequestControllerRef.current) {
        matchRequestControllerRef.current.abort();
      }
    };
  }, []);

  // Renders the shared carousel used to favorite titles or open match details.
  // The mode tells the carousel which action to use when a title is clicked.
  function renderTitleCarousel(titles, mode) {
    if (mode === undefined) {
      mode = "favorite";
    }

    return (
      <Carousel
        items={titles}
        mode={mode}
        liked={isFavorite}
        favorite={toggleFavorite}
        check={analyzeTitleMatch}
      />
    );
  }
  // Shared search field used on onboarding and match-details screens.
  const searchField = (
    <label className="search">
      <span aria-hidden="true">⌕</span>
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search real movies & TV shows…"
        aria-label="Search movies and TV shows"
      />
      {isSearchBusy && <span className="muted">Searching…</span>}
    </label>
  );
  // Returns to onboarding so the user can add or change favorites.
  function backToFavorites() {
    setPage("onboarding");
    setSearchQuery("");
    setErrorMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let discoverButtonClass = "";
  if (page === "discover") {
    discoverButtonClass = "current";
  }

  let tasteButtonClass = "";
  if (page === "taste") {
    tasteButtonClass = "current";
  }

  return (
    <div className="app">
      <header className="header">
        <button
          className="brand"
          onClick={() => {
            setPage("welcome");
            setSearchQuery("");
            setErrorMessage("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          reel<span>match.</span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={discoverButtonClass}
            onClick={() => {
              if (taste.favorites.length > 0) {
                setPage("discover");
              } else {
                setPage("onboarding");
              }
              setErrorMessage("");
            }}
          >
            Discover
          </button>
          <button
            className={tasteButtonClass}
            onClick={() => {
              setPage("taste");
              setErrorMessage("");
            }}
          >
            My Taste
          </button>
        </nav>
      </header>
      <main>
        {/* Show only the screen selected by page. Buttons call setPage to switch it. */}
        {page === "welcome" && (
          <WelcomeScreen
            setPage={setPage}
            setErrorMessage={setErrorMessage}
          />
        )}
        {page === "onboarding" && (
          <OnboardingScreen
            searchField={searchField}
            errorMessage={errorMessage}
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearchBusy={isSearchBusy}
            renderTitleCarousel={renderTitleCarousel}
            isLibraryBusy={isLibraryBusy}
            libraryRows={libraryRows}
            taste={taste}
            resetAutomaticRecommendationRequest={
              resetAutomaticRecommendationRequest
            }
            setPage={setPage}
            setRecommendationRows={setRecommendationRows}
            setSearchQuery={setSearchQuery}
            setErrorMessage={setErrorMessage}
          />
        )}
        {page === "discover" && (
          <DiscoverScreen
            backToFavorites={backToFavorites}
            isBusy={isBusy}
            requestRecommendations={requestRecommendations}
            errorMessage={errorMessage}
            recommendationRows={recommendationRows}
            renderTitleCarousel={renderTitleCarousel}
            setSearchQuery={setSearchQuery}
            setErrorMessage={setErrorMessage}
            setPage={setPage}
          />
        )}
        {page === "match" && (
          <MatchScreen
            searchField={searchField}
            errorMessage={errorMessage}
            selectedTitle={selectedTitle}
            isBusy={isBusy}
            matchAnalysis={matchAnalysis}
            categoryClass={categoryClass}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            taste={taste}
            toggleFeedback={toggleFeedback}
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearchBusy={isSearchBusy}
            renderTitleCarousel={renderTitleCarousel}
          />
        )}
        {page === "taste" && (
          <TasteScreen
            setPage={setPage}
            setShowHistory={setShowHistory}
            showHistory={showHistory}
            taste={taste}
            preferenceQuestions={PREFERENCE_QUESTIONS}
            updatePreference={updatePreference}
            setTaste={setTaste}
            renderTitleCarousel={renderTitleCarousel}
            analyzeTitleMatch={analyzeTitleMatch}
            toggleFeedback={toggleFeedback}
          />
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
