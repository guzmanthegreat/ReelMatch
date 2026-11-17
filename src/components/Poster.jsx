import React from "react";

export function Poster({ x }) {
  // Some TMDB records do not have artwork. A text placeholder keeps the card
  // usable and prevents a broken image from disrupting the layout.
  return x.poster ? (
    <img src={x.poster} alt={`${x.title} poster`} loading="lazy" />
  ) : (
    <div className="missing">No poster</div>
  );
}

