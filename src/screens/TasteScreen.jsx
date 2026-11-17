import React from "react";
import { Poster } from "../components/Poster";
import { key } from "../utils";

// Shows saved favorites, reactions, preferences, and discovery history.
export default function TasteScreen(props) {
  const setPage = props.setPage;
  const setShowHistory = props.setShowHistory;
  const showHistory = props.showHistory;
  const taste = props.taste;
  const preferenceQuestions = props.preferenceQuestions;
  const updatePreference = props.updatePreference;
  const setTaste = props.setTaste;
  const renderTitleCarousel = props.renderTitleCarousel;
  const analyzeTitleMatch = props.analyzeTitleMatch;
  const toggleFeedback = props.toggleFeedback;

  // Build the preference questions and their buttons.
  const preferencePanels = [];
  for (
    let questionIndex = 0;
    questionIndex < preferenceQuestions.length;
    questionIndex += 1
  ) {
    const question = preferenceQuestions[questionIndex];
    let selectedPreference = "";
    if (taste.preferences && taste.preferences[question.id]) {
      selectedPreference = taste.preferences[question.id];
    }

    const preferenceButtons = [];
    for (
      let optionIndex = 0;
      optionIndex < question.options.length;
      optionIndex += 1
    ) {
      const option = question.options[optionIndex];
      let buttonClass = "preference-choice";
      if (selectedPreference === option) {
        buttonClass += " chosen";
      }

      preferenceButtons.push(
        <button
          key={option}
          className={buttonClass}
          aria-pressed={selectedPreference === option}
          onClick={() => updatePreference(question.id, option)}
        >
          {option}
        </button>,
      );
    }

    preferencePanels.push(
      <div className="preference-question" key={question.id}>
        <h2>{question.title}</h2>
        <div className="preference-options">{preferenceButtons}</div>
      </div>,
    );
  }

  // Create a section for each kind of reaction that has saved titles.
  const reactionChoices = [
    { value: "love", label: "Loved It" },
    { value: "watch", label: "Want to Watch" },
    { value: "seen", label: "Already Seen" },
    { value: "no", label: "Not for Me" },
  ];
  const reactionGroups = [];
  const feedbackTitleIds = Object.keys(taste.feedback);
  const feedbackTitles = [];
  for (let index = 0; index < feedbackTitleIds.length; index += 1) {
    const titleId = feedbackTitleIds[index];
    feedbackTitles.push(taste.feedback[titleId]);
  }
  for (
    let choiceIndex = 0;
    choiceIndex < reactionChoices.length;
    choiceIndex += 1
  ) {
    const choice = reactionChoices[choiceIndex];
    const reactionTitles = [];
    for (
      let titleIndex = 0;
      titleIndex < feedbackTitles.length;
      titleIndex += 1
    ) {
      const title = feedbackTitles[titleIndex];
      if (title.value === choice.value) {
        reactionTitles.push(title);
      }
    }

    if (reactionTitles.length === 0) {
      continue;
    }

    const titleRows = [];
    for (
      let titleIndex = 0;
      titleIndex < reactionTitles.length;
      titleIndex += 1
    ) {
      const title = reactionTitles[titleIndex];
      let titleYear = title.year;
      if (!titleYear) {
        titleYear = "Unknown year";
      }

      let titleType = "Movie";
      if (title.type === "tv") {
        titleType = "TV";
      }

      titleRows.push(
        <div className="taste-row" key={key(title)}>
          <button
            className="taste-poster"
            onClick={() => analyzeTitleMatch(title)}
            aria-label={`Check ${title.title}`}
          >
            <Poster x={title} />
          </button>
          <div className="taste-row-info">
            <strong>{title.title}</strong>
            <span className="muted">
              {titleYear} · {titleType}
            </span>
          </div>
          <button
            className="small-button"
            onClick={() => toggleFeedback(title, choice.value)}
          >
            Remove
          </button>
        </div>,
      );
    }

    reactionGroups.push(
      <section className="taste-group" key={choice.value}>
        <h2 className="collection-title">
          {choice.label}{" "}
          <span className="muted">({reactionTitles.length})</span>
        </h2>
        <div className="taste-list">{titleRows}</div>
      </section>,
    );
  }

  // Show a carousel when favorites exist, or a message when they do not.
  let favoritesContent;
  if (taste.favorites.length > 0) {
    favoritesContent = renderTitleCarousel(taste.favorites);
  } else {
    favoritesContent = (
      <div className="empty">
        No favorites yet. Add a few titles to start shaping your taste.
      </div>
    );
  }

  // Clears discovery history only after the user confirms the action.
  function clearHistory() {
    const shouldClearHistory = window.confirm(
      "Clear recommendation history? Your favorites and reactions will stay saved.",
    );
    if (!shouldClearHistory) {
      return;
    }

    setTaste((currentTaste) => {
      return {
        ...currentTaste,
        history: [],
      };
    });
  }

  // React passes the latest visibility value to this state-update function.
  function toggleHistoryVisibility(currentVisibility) {
    if (currentVisibility) {
      return false;
    }
    return true;
  }

  let historyButtonText = "Show";
  if (showHistory) {
    historyButtonText = "Hide";
  }

  return (
    <section className="section">
      <div className="step-label">YOUR COLLECTION</div>
      <h1>
        My <em>Taste.</em>
      </h1>
      <p>Your favorites, all in one place.</p>
      <div className="taste-actions">
        <button className="secondary" onClick={() => setPage("onboarding")}>
          + Add favorites
        </button>
        <button
          className="secondary subtle-control"
          onClick={() => setShowHistory(toggleHistoryVisibility)}
        >
          {historyButtonText} discovery history (
          {taste.history.length})
        </button>
      </div>
      <details className="taste-settings">
        <summary>Preferences</summary>
        <div className="preference-panel">{preferencePanels}</div>
      </details>
      {showHistory && (
        <div className="history-note">
          ReelMatch remembers {taste.history.length} recently recommended titles
          in this browser.{" "}
          <button className="small-button" onClick={clearHistory}>
            Clear history
          </button>
        </div>
      )}
      <h2 className="collection-title">Favorites</h2>
      {favoritesContent}
      {reactionGroups}
    </section>
  );
}

