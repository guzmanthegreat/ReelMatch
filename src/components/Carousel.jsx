import React, { useEffect, useRef, useState } from "react";
import { key, titleKey, categoryClass } from "../utils";
import { Poster } from "./Poster";

export function Carousel({ items, mode, liked, favorite, check }) {
  // Carousel is shared by onboarding, recommendations, search results, and
  // the taste page. Its mode determines whether clicking selects or analyzes.
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [visible, setVisible] = useState(1);
  const uniqueItems = Array.from(
    new Map(items.map((x) => [key(x), x])).values(),
  ).filter((x) => titleKey(x));
  const count = uniqueItems.length;
  // The component measures the viewport so it knows how many cards are
  // visible and can create a seamless loop without duplicating data in state.
  useEffect(() => {
    const update = () => {
      const width = viewportRef.current?.clientWidth || 0;
      const cardWidth =
        trackRef.current?.firstElementChild?.getBoundingClientRect().width ||
        158;
      setVisible(
        Math.max(
          1,
          Math.min(count || 1, Math.floor((width + 12) / (cardWidth + 12))),
        ),
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [count]);
  const stepSize = () => {
    const track = trackRef.current;
    const card = track?.firstElementChild;
    if (!track || !card) return 0;
    const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
    return card.getBoundingClientRect().width + gap;
  };
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      const card = track?.firstElementChild;
      const gap = Number.parseFloat(track ? getComputedStyle(track).gap : "0") || 0;
      const step = (card?.getBoundingClientRect().width || 0) + gap;
      if (viewport && step && count > visible)
        viewport.scrollLeft = step * visible;
    });
    return () => cancelAnimationFrame(frame);
  }, [items, count, visible]);
  const normalize = () => {
    const viewport = viewportRef.current;
    const step = stepSize();
    if (!viewport || !step || count <= visible) return;
    const realStart = step * visible;
    const realEnd = realStart + step * count;
    let target = null;
    if (viewport.scrollLeft < realStart - step * 0.5)
      target = viewport.scrollLeft + step * count;
    else if (viewport.scrollLeft >= realEnd - step * 0.5)
      target = viewport.scrollLeft - step * count;
    if (target !== null) {
      viewport.classList.add("carousel-normalizing");
      viewport.scrollLeft = target;
      requestAnimationFrame(() =>
        viewport.classList.remove("carousel-normalizing"),
      );
    }
  };
  const move = (direction) => {
    // Moving by most of a viewport feels natural with a mouse, trackpad, or
    // touch screen while still leaving part of the next group visible.
    if (count <= visible) return;
    const viewport = viewportRef.current;
    const step = stepSize();
    if (viewport && step)
      viewport.scrollBy({
        left: direction * Math.max(step * 2, viewport.clientWidth * 0.72),
        behavior: "smooth",
      });
  };
  const displayItems =
    count > visible
      ? [
          ...uniqueItems.slice(-visible),
          ...uniqueItems,
          ...uniqueItems.slice(0, visible),
        ]
      : uniqueItems;
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
          className={`poster-grid poster-carousel ${count <= visible ? "is-short" : ""}`}
          ref={trackRef}
        >
          {displayItems.map((x, itemIndex) => (
            <article
              className={`poster-card ${mode === "favorite" && liked(x) ? "is-picked" : ""}`}
              key={`${key(x)}-${itemIndex}`}
            >
              <button
                className="poster-open"
                onClick={() => {
                  if (mode === "favorite") favorite(x);
                  else check(x);
                }}
                aria-label={
                  mode === "favorite"
                    ? `${liked(x) ? "Remove" : "Select"} ${x.title}`
                    : `See match details for ${x.title}`
                }
              >
                <Poster x={x} />
                {mode === "favorite" && (
                  <span className="poster-check">{liked(x) ? "✓" : "+"}</span>
                )}
                {mode !== "favorite" && x.category && (
                  <span className={`poster-match ${categoryClass(x.category)}`}>
                    {x.category}
                  </span>
                )}
              </button>
              <div className="card-details">
                <strong title={x.title}>{x.title}</strong>
                <span>{x.year || (x.type === "tv" ? "TV" : "Movie")}</span>
              </div>
            </article>
          ))}
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

