import React, { useEffect, useRef, useState } from "react";
import { key, titleKey, categoryClass } from "../utils";
import { Poster } from "./Poster";

// Reuses the same title carousel on onboarding, recommendations, search, and taste screens.
export function Carousel(props) {
  const items = props.items;
  const mode = props.mode;
  const liked = props.liked;
  const favorite = props.favorite;
  const check = props.check;

  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  // useState returns the current value and a function that updates it.
  const [visible, setVisible] = useState(1);

  // Keep the last copy of each title, matching how a Map replaced duplicates.
  const itemsById = [];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const itemId = key(item);
    let existingIndex = -1;

    for (let savedIndex = 0; savedIndex < itemsById.length; savedIndex += 1) {
      if (key(itemsById[savedIndex]) === itemId) {
        existingIndex = savedIndex;
        break;
      }
    }

    if (existingIndex === -1) {
      itemsById.push(item);
    } else {
      itemsById[existingIndex] = item;
    }
  }

  // Remove titles without a name after duplicate titles have been replaced.
  const uniqueItems = [];
  for (let itemIndex = 0; itemIndex < itemsById.length; itemIndex += 1) {
    const item = itemsById[itemIndex];
    if (titleKey(item)) {
      uniqueItems.push(item);
    }
  }

  const count = uniqueItems.length;

  useEffect(() => {
    // Measure the viewport and card width to find how many cards fit.
    // Recalculate this number if the browser window changes size.
    const update = () => {
      let width = 0;
      if (viewportRef.current) {
        width = viewportRef.current.clientWidth;
      }

      let cardWidth = 158;
      if (trackRef.current && trackRef.current.firstElementChild) {
        cardWidth =
          trackRef.current.firstElementChild.getBoundingClientRect().width;
        if (cardWidth === 0) {
          cardWidth = 158;
        }
      }

      let itemCountForLayout = count;
      if (itemCountForLayout === 0) {
        itemCountForLayout = 1;
      }

      const cardsThatFit = Math.floor((width + 12) / (cardWidth + 12));
      const visibleCount = Math.max(
        1,
        Math.min(itemCountForLayout, cardsThatFit),
      );
      setVisible(visibleCount);
    };

    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, [count]);

  // Finds the scroll distance for one card, including the gap after it.
  function getStepSize() {
    const track = trackRef.current;
    if (!track) {
      return 0;
    }

    const card = track.firstElementChild;
    if (!card) {
      return 0;
    }

    let gap = Number.parseFloat(getComputedStyle(track).gap);
    if (Number.isNaN(gap)) {
      gap = 0;
    }

    return card.getBoundingClientRect().width + gap;
  }

  // Start at the first real card, after the temporary cards used for looping.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) {
        return;
      }

      const card = track.firstElementChild;
      if (!card) {
        return;
      }

      let gap = Number.parseFloat(getComputedStyle(track).gap);
      if (Number.isNaN(gap)) {
        gap = 0;
      }

      const step = card.getBoundingClientRect().width + gap;
      if (count > visible && step > 0) {
        viewport.scrollLeft = step * visible;
      }
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [items, count, visible]);

  // Reposition the carousel when it reaches the temporary cards at either end.
  function normalize() {
    const viewport = viewportRef.current;
    const step = getStepSize();
    if (!viewport || !step || count <= visible) {
      return;
    }

    const realStart = step * visible;
    const realEnd = realStart + step * count;
    let target = null;
    if (viewport.scrollLeft < realStart - step * 0.5) {
      target = viewport.scrollLeft + step * count;
    } else if (viewport.scrollLeft >= realEnd - step * 0.5) {
      target = viewport.scrollLeft - step * count;
    }

    if (target !== null) {
      viewport.classList.add("carousel-normalizing");
      viewport.scrollLeft = target;
      requestAnimationFrame(() => {
        viewport.classList.remove("carousel-normalizing");
      });
    }
  }

  // Scroll forward or backward by most of the visible carousel width.
  function move(direction) {
    if (count <= visible) {
      return;
    }

    const viewport = viewportRef.current;
    const step = getStepSize();
    if (viewport && step) {
      viewport.scrollBy({
        left: direction * Math.max(step * 2, viewport.clientWidth * 0.72),
        behavior: "smooth",
      });
    }
  }

  // Add copies of the first and last cards so scrolling can loop smoothly.
  const displayItems = [];
  if (count > visible) {
    const firstItemBeforeLoop = count - visible;
    for (
      let itemIndex = firstItemBeforeLoop;
      itemIndex < count;
      itemIndex += 1
    ) {
      displayItems.push(uniqueItems[itemIndex]);
    }
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      displayItems.push(uniqueItems[itemIndex]);
    }
    for (let itemIndex = 0; itemIndex < visible; itemIndex += 1) {
      displayItems.push(uniqueItems[itemIndex]);
    }
  } else {
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      displayItems.push(uniqueItems[itemIndex]);
    }
  }

  // Build each poster card and choose the label for its click action.
  const posterCards = [];
  for (let itemIndex = 0; itemIndex < displayItems.length; itemIndex += 1) {
    const item = displayItems[itemIndex];
    const itemId = key(item);
    let cardClass = "poster-card";
    if (mode === "favorite" && liked(item)) {
      cardClass += " is-picked";
    }

    let openLabel = `See match details for ${item.title}`;
    if (mode === "favorite") {
      let favoriteAction = "Select";
      if (liked(item)) {
        favoriteAction = "Remove";
      }
      openLabel = `${favoriteAction} ${item.title}`;
    }

    let yearLabel = item.year;
    if (!yearLabel) {
      if (item.type === "tv") {
        yearLabel = "TV";
      } else {
        yearLabel = "Movie";
      }
    }

    let posterBadge = null;
    if (mode === "favorite") {
      let favoriteMark = "+";
      if (liked(item)) {
        favoriteMark = "✓";
      }
      posterBadge = <span className="poster-check">{favoriteMark}</span>;
    } else if (item.category) {
      posterBadge = (
        <span className={`poster-match ${categoryClass(item.category)}`}>
          {item.category}
        </span>
      );
    }

    posterCards.push(
      <article
        className={cardClass}
        key={`${itemId}-${itemIndex}`}
      >
        <button
          className="poster-open"
          onClick={() => {
            if (mode === "favorite") {
              favorite(item);
            } else {
              check(item);
            }
          }}
          aria-label={openLabel}
        >
          <Poster x={item} />
          {posterBadge}
        </button>
        <div className="card-details">
          <strong title={item.title}>{item.title}</strong>
          <span>{yearLabel}</span>
        </div>
      </article>,
    );
  }

  let posterGridClass = "poster-grid poster-carousel";
  if (count <= visible) {
    posterGridClass += " is-short";
  }

  return (
    <div className="carousel-shell">
      {count > visible && (
        <button
          className="carousel-arrow carousel-prev"
          onClick={() => move(-1)}
          aria-label="Show previous titles"
        >
          ‹
        </button>
      )}
      <div className="poster-viewport" ref={viewportRef} onScroll={normalize}>
        <div
          className={posterGridClass}
          ref={trackRef}
        >
          {posterCards}
        </div>
      </div>
      {count > visible && (
        <button
          className="carousel-arrow carousel-next"
          onClick={() => move(1)}
          aria-label="Show next titles"
        >
          ›
        </button>
      )}
    </div>
  );
}

