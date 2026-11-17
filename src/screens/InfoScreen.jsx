import React from "react";

const GUIDE_ARTICLES = [
  {
    title: "How to choose a movie when nothing sounds good",
    intro:
      "The fastest way to escape endless scrolling is to start with your mood, not a genre. A small amount of honest input gives ReelMatch a much better signal than trying to name a perfect movie from the start.",
    paragraphs: [
      "Begin with the feeling you want after the credits: energized, comforted, surprised, or thoughtful. Then think about your available attention. A fast-paced thriller and a slow-burn drama can both be excellent choices, but they solve very different movie-night problems.",
      "Finally, use a few titles you already love as anchors. They do not need to be your all-time favorites; they only need to represent the kind of night you want tonight. ReelMatch uses those signals to narrow a large catalog into a smaller set worth considering.",
    ],
  },
  {
    title: "A better way to build a movie watchlist",
    intro:
      "A useful watchlist is not a warehouse of every movie you might someday watch. It is a short list that reflects your current taste and makes the next choice easier.",
    paragraphs: [
      "Keep a mix of reliable favorites and one or two discoveries. Familiar choices remove decision fatigue, while discoveries keep the list from becoming repetitive. It also helps to separate movies for different situations: solo viewing, date night, a group, or a short weeknight session.",
      "When a recommendation misses, treat that as useful information instead of a failure. Your skip and like decisions help describe your taste more clearly over time, especially when you give feedback across different genres and moods.",
    ],
  },
  {
    title: "Why movie recommendations feel personal",
    intro:
      "Genre labels are a helpful starting point, but they rarely explain why two people respond differently to the same movie. Personal recommendations work best when they combine taste, context, and intent.",
    paragraphs: [
      "Someone who enjoys a tense mystery may want a clever puzzle one night and an atmospheric story the next. The title alone cannot capture that difference. That is why ReelMatch asks about pacing, mood, and format alongside favorite movies.",
      "The goal is not to predict a perfect score. It is to make the search space feel manageable and give you a few choices you can feel good about pressing play on.",
    ],
  },
];

function InfoLayout({ eyebrow, title, intro, children }) {
  return (
    <section className="section info-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {intro && <p className="info-intro">{intro}</p>}
      <div className="info-content">{children}</div>
    </section>
  );
}

export default function InfoScreen({ type }) {
  if (type === "guides") {
    return (
      <InfoLayout
        eyebrow="MOVIE NIGHT NOTES"
        title={<>Find your next <em>favorite.</em></>}
        intro="Original, practical ideas for choosing movies, building a watchlist, and making recommendation tools work better for you."
      >
        <div className="guide-grid">
          {GUIDE_ARTICLES.map((article) => (
            <article className="guide-card" key={article.title}>
              <p className="eyebrow">REELMATCH GUIDE</p>
              <h2>{article.title}</h2>
              <p>{article.intro}</p>
              {article.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </div>
      </InfoLayout>
    );
  }

  if (type === "about") {
    return (
      <InfoLayout
        eyebrow="ABOUT REELMATCH"
        title={<>Movie night, <em>solved.</em></>}
        intro="ReelMatch is a movie-discovery tool for the moment when everyone wants to watch something but nobody knows what."
      >
        <p>
          Instead of asking you to browse an endless catalog, ReelMatch starts
          with a few titles you already know. Your selections, mood, pacing,
          and preferred format become a simple taste profile that helps narrow
          the next choice.
        </p>
        <p>
          ReelMatch is designed to support your decision, not replace it. The
          recommendations are invitations to explore, and your feedback makes
          the experience more useful the next time you open it.
        </p>
        <h2>How it works</h2>
        <ol>
          <li>Pick a few movies or shows that match your taste.</li>
          <li>Tell us what kind of viewing experience you want tonight.</li>
          <li>Explore a focused set of recommendations and compare a title.</li>
        </ol>
      </InfoLayout>
    );
  }

  if (type === "privacy") {
    return (
      <InfoLayout
        eyebrow="PRIVACY"
        title="Your taste stays yours."
        intro="This page explains the information ReelMatch uses to provide recommendations. Replace the contact email below with your final support address before launch."
      >
        <h2>Information stored in your browser</h2>
        <p>
          ReelMatch stores your selected favorites, feedback, preferences, and
          recommendation history in your browser&apos;s local storage. This lets
          the app remember your taste on the same device. You can clear this
          information by clearing the site data in your browser.
        </p>
        <h2>Requests to our services</h2>
        <p>
          When you search for titles or request recommendations, the app sends
          the information needed to fulfill that request to ReelMatch&apos;s
          services and the movie-data providers used by the app. We do not ask
          for an account, name, or password to use the core experience.
        </p>
        <h2>Cookies and advertising</h2>
        <p>
          If advertising is enabled, advertising partners may use cookies or
          similar technologies to serve and measure ads. Visitors will be
          shown the consent options required in applicable regions, and this
          policy will be updated with the final advertising providers before
          ads go live.
        </p>
        <h2>Contact</h2>
        <p>
          Questions about privacy can be sent to{" "}
          <a href="mailto:hello@reelmatch.app">hello@reelmatch.app</a>.
        </p>
      </InfoLayout>
    );
  }

  if (type === "terms") {
    return (
      <InfoLayout
        eyebrow="TERMS OF USE"
        title="Use ReelMatch thoughtfully."
        intro="These simple terms describe the expectations for using the ReelMatch website."
      >
        <h2>The service</h2>
        <p>
          ReelMatch provides movie and TV discovery suggestions for personal,
          non-commercial use. Recommendations are generated from the
          information available to the service and are not guarantees that a
          title will be available, appropriate for every viewer, or to your
          liking.
        </p>
        <h2>Fair use</h2>
        <p>
          Please do not abuse the search or recommendation services, attempt to
          disrupt the site, or use automated traffic to create requests. We may
          limit access when necessary to protect the service and its users.
        </p>
        <h2>Third-party data</h2>
        <p>
          Title metadata and images may come from third-party services. Those
          services retain their respective rights and terms. ReelMatch is not
          affiliated with or endorsed by those providers unless explicitly
          stated.
        </p>
      </InfoLayout>
    );
  }

  return (
    <InfoLayout
      eyebrow="CONTACT"
      title={<>Let&apos;s talk <em>movies.</em></>}
      intro="Found a bug, have a recommendation, or want to share feedback? We would love to hear from you."
    >
      <p>
        Email us at <a href="mailto:hello@reelmatch.app">hello@reelmatch.app</a>
        . Please include the page you were using and a short description of
        what happened if you are reporting a problem.
      </p>
    </InfoLayout>
  );
}
