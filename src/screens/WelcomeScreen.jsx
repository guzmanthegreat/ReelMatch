import React from "react";

// Shows the welcome screen and starts onboarding.
export default function WelcomeScreen(props) {
  const setPage = props.setPage;
  const setErrorMessage = props.setErrorMessage;

  return (
    <section className="hero">
      <div className="hero-content">
        <h1>
          Movie night,
          <br />
          <em>solved.</em>
        </h1>
        <p>Movies you'll actually love.</p>
        <button
          className="primary hero-button"
          onClick={() => {
            setPage("onboarding");
            setErrorMessage("");
          }}
        >
          Get Started <span>→</span>
        </button>
      </div>
    </section>
  );
}
