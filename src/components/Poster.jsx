import React from "react";

// Shows a title's poster, or a placeholder when artwork is missing.
export function Poster(props) {
  const x = props.x;

  if (x.poster) {
    return <img src={x.poster} alt={`${x.title} poster`} loading="lazy" />;
  }

  return <div className="missing">No poster</div>;
}

