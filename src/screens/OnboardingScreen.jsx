import React from "react";

// Shows title search and collections for choosing favorites.
export default function OnboardingScreen(props) {
  const searchField = props.searchField;
  const errorMessage = props.errorMessage;
  const searchQuery = props.searchQuery;
  const searchResults = props.searchResults;
  const isSearchBusy = props.isSearchBusy;
  const renderTitleCarousel = props.renderTitleCarousel;
  const isLibraryBusy = props.isLibraryBusy;
  const libraryRows = props.libraryRows;
  const taste = props.taste;
  const resetAutomaticRecommendationRequest =
    props.resetAutomaticRecommendationRequest;
  const setPage = props.setPage;
  const setRecommendationRows = props.setRecommendationRows;
  const setSearchQuery = props.setSearchQuery;
  const setErrorMessage = props.setErrorMessage;

  // Prepare the collections before placing them in the screen.
  const collectionSections = [];
  for (let rowIndex = 0; rowIndex < libraryRows.length; rowIndex += 1) {
    const row = libraryRows[rowIndex];
    let rowItems = row.items;
    if (!Array.isArray(rowItems)) {
      rowItems = [];
    }

    collectionSections.push(
      <section className="title-row" key={row.title}>
        <div className="collection-heading">
          <h2>{row.title}</h2>
          <span></span>
        </div>
        {renderTitleCarousel(rowItems)}
      </section>,
    );
  }

  // Choose what appears below search: results, a loading message, or collections.
  let titleSelectionContent;
  if (searchQuery.trim().length >= 2) {
    let searchResultsContent;
    let searchHint = "Tap to select";
    if (isSearchBusy) {
      searchHint = "Searching…";
      searchResultsContent = (
        <p className="inline-loading" role="status">
          Searching for titles…
        </p>
      );
    } else {
      searchResultsContent = renderTitleCarousel(searchResults);
    }

    titleSelectionContent = (
      <>
        <div className="collection-heading">
          <h2>Search results</h2>
          <span>{searchHint}</span>
        </div>
        {searchResultsContent}
      </>
    );
  } else if (isLibraryBusy) {
    titleSelectionContent = (
      <p className="inline-loading" role="status">
        Loading title collections…
      </p>
    );
  } else {
    titleSelectionContent = collectionSections;
  }

  // Show the names of the two most recently added favorites.
  let recentFavoriteNames = "";
  const favoriteCount = taste.favorites.length;
  const firstRecentFavorite = Math.max(0, favoriteCount - 2);
  for (
    let favoriteIndex = firstRecentFavorite;
    favoriteIndex < favoriteCount;
    favoriteIndex += 1
  ) {
    if (favoriteIndex > firstRecentFavorite) {
      recentFavoriteNames += ", ";
    }

    let favoriteName = taste.favorites[favoriteIndex].title;
    if (favoriteName === null || favoriteName === undefined) {
      favoriteName = "";
    } else {
      favoriteName = String(favoriteName);
    }
    recentFavoriteNames += favoriteName;
  }
  if (favoriteCount > 2) {
    recentFavoriteNames += "…";
  }

  return (
    <section className="section onboarding">
      <div className="step-label">STEP 1 OF 2</div>
      <h1>
        Pick movies you <em>love.</em>
      </h1>
      <p>
        Tap any titles you already love. You can come back and add more anytime.
      </p>
      {searchField}
      {errorMessage && (
        <p className="error" role="alert">
          {errorMessage}
        </p>
      )}
      {titleSelectionContent}
      <div className="sticky-next">
        <span>
          <strong>{favoriteCount}</strong> selected
          {favoriteCount > 0 && <small> — {recentFavoriteNames}</small>}
        </span>
        <button
          className="primary"
          disabled={favoriteCount === 0}
          onClick={() => {
            resetAutomaticRecommendationRequest();
            setPage("discover");
            setRecommendationRows([]);
            setSearchQuery("");
            setErrorMessage("");
          }}
        >
          Find My Movies <span>→</span>
        </button>
      </div>
    </section>
  );
}

