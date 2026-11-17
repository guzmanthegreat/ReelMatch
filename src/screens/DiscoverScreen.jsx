import React from "react";

// Shows personalized recommendations and lets the user request another batch.
export default function DiscoverScreen(props) {
  const backToFavorites = props.backToFavorites;
  const isBusy = props.isBusy;
  const requestRecommendations = props.requestRecommendations;
  const errorMessage = props.errorMessage;
  const recommendationRows = props.recommendationRows;
  const renderTitleCarousel = props.renderTitleCarousel;
  const setSearchQuery = props.setSearchQuery;
  const setErrorMessage = props.setErrorMessage;
  const setPage = props.setPage;

  // Build one section for each recommendation row.
  const recommendationSections = [];
  for (
    let rowIndex = 0;
    rowIndex < recommendationRows.length;
    rowIndex += 1
  ) {
    const row = recommendationRows[rowIndex];
    let rowItems = row.items;
    if (!Array.isArray(rowItems)) {
      rowItems = [];
    }

    recommendationSections.push(
      <section className="title-row" key={row.title}>
        <div className="collection-heading">
          <h2>{row.title}</h2>
          <span>AI-ranked for you</span>
        </div>
        {renderTitleCarousel(rowItems, "feedback")}
      </section>,
    );
  }

  let recommendationContent;
  if (recommendationRows.length > 0) {
    recommendationContent = recommendationSections;
  } else if (!isBusy) {
    recommendationContent = (
      <div className="empty">
        <p>Your next movie is one click away.</p>
        <button className="primary" onClick={requestRecommendations}>
          Find movies →
        </button>
      </div>
    );
  }

  let refreshButtonText = "↻ New picks";
  if (isBusy) {
    refreshButtonText = "Finding…";
  }

  return (
    <section className="section discover">
      <div className="section-top">
        <div>
          <div className="step-label">STEP 2 OF 2 · CURATED FOR YOU</div>
          <h1>
            Your next <em>favorite.</em>
          </h1>
        </div>
        <div className="section-actions">
          <button
            className="secondary add-favorites"
            onClick={backToFavorites}
          >
            ← Add more favorites
          </button>
          <button
            className="primary refresh"
            disabled={isBusy}
            onClick={requestRecommendations}
          >
            {refreshButtonText}
          </button>
        </div>
      </div>
      {errorMessage && (
        <p className="error" role="alert">
          {errorMessage}
        </p>
      )}
      {isBusy && (
        <div className="finding-state" role="status">
          <span className="screen-loading-spinner" />{" "}
          <strong>Finding your movies…</strong>
          <small>Give us a sec — we’re matching your taste.</small>
        </div>
      )}
      {recommendationContent}
      <div className="discover-bottom">
        <button
          className="secondary"
          onClick={() => {
            setSearchQuery("");
            setErrorMessage("");
            setPage("match");
          }}
        >
          Search any movie ↗
        </button>
      </div>
    </section>
  );
}

