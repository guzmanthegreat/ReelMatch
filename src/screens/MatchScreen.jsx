import React from "react";
import { Poster } from "../components/Poster";
import { key as getTitleId } from "../utils";

// Shows a selected title's analysis and lets the user search for another title.
export default function MatchScreen(props) {
  const searchField = props.searchField;
  const errorMessage = props.errorMessage;
  const selectedTitle = props.selectedTitle;
  const isBusy = props.isBusy;
  const matchAnalysis = props.matchAnalysis;
  const categoryClass = props.categoryClass;
  const isFavorite = props.isFavorite;
  const toggleFavorite = props.toggleFavorite;
  const taste = props.taste;
  const toggleFeedback = props.toggleFeedback;
  const searchQuery = props.searchQuery;
  const searchResults = props.searchResults;
  const isSearchBusy = props.isSearchBusy;
  const renderTitleCarousel = props.renderTitleCarousel;

  const reactionChoices = [
    { value: "love", label: "Loved It" },
    { value: "watch", label: "Want to Watch" },
    { value: "seen", label: "Already Seen" },
    { value: "no", label: "Not for Me" },
  ];

  let selectedReaction = "";
  let favoriteButtonClass = "secondary";
  let favoriteButtonText = "+ Add favorite";
  if (selectedTitle) {
    const selectedTitleId = getTitleId(selectedTitle);
    const savedReaction = taste.feedback[selectedTitleId];
    if (savedReaction) {
      selectedReaction = savedReaction.value;
    }

    if (isFavorite(selectedTitle)) {
      favoriteButtonClass += " active-control";
      favoriteButtonText = "✓ Favorite";
    }
  }

  // Create one button for each reaction available to the user.
  const reactionButtons = [];
  for (
    let choiceIndex = 0;
    choiceIndex < reactionChoices.length;
    choiceIndex += 1
  ) {
    const choice = reactionChoices[choiceIndex];
    let reactionButtonClass = "reaction-control";
    if (selectedReaction === choice.value) {
      reactionButtonClass += " active";
    }

    reactionButtons.push(
      <button
        key={choice.value}
        className={reactionButtonClass}
        onClick={() => toggleFeedback(selectedTitle, choice.value)}
      >
        {choice.label}
      </button>,
    );
  }

  let analysisContent;
  if (isBusy && (!matchAnalysis || !matchAnalysis.reason)) {
    analysisContent = <p>Analyzing your taste…</p>;
  } else if (matchAnalysis) {
    let categoryName = matchAnalysis.category;
    if (!categoryName) {
      categoryName = "Reading the vibe…";
    }

    let analysisReason = matchAnalysis.reason;
    if (!analysisReason) {
      analysisReason = "Okayyy, checking the vibe…";
    }

    analysisContent = (
      <>
        <h3
          className={`category-badge analysis-category ${categoryClass(matchAnalysis.category)}`}
        >
          {categoryName}
        </h3>
        <div className="chat-bubble">
          <span className="chat-avatar">rm</span>
          <p>
            {analysisReason}
            <span className="typing-cursor" />
          </p>
        </div>
      </>
    );
  } else {
    analysisContent = <p>Select a title to check your match.</p>;
  }

  let selectedTitleContent;
  if (selectedTitle) {
    selectedTitleContent = (
      <div className="selected-title">
        <Poster x={selectedTitle} />
        <div>
          <div className="eyebrow">AI MATCH ANALYSIS</div>
          <h2>
            {selectedTitle.title}{" "}
            <span className="muted">{selectedTitle.year}</span>
          </h2>
          {analysisContent}
          <div className="detail-actions">
            <button
              className={favoriteButtonClass}
              onClick={() => toggleFavorite(selectedTitle)}
            >
              {favoriteButtonText}
            </button>
            {reactionButtons}
          </div>
        </div>
      </div>
    );
  }

  let searchResultsContent;
  if (searchQuery.trim().length >= 2) {
    if (isSearchBusy) {
      searchResultsContent = (
        <p className="inline-loading">Searching for titles…</p>
      );
    } else {
      searchResultsContent = renderTitleCarousel(searchResults, "check");
    }
  }

  return (
    <section className="section">
      <div className="step-label">MATCH DETAILS</div>
      <h1>
        Find a <em>movie.</em>
      </h1>
      <p>Search any title to see how it fits your taste.</p>
      {searchField}
      {errorMessage && (
        <p className="error" role="alert">
          {errorMessage}
        </p>
      )}
      {selectedTitleContent}
      {searchResultsContent}
    </section>
  );
}

