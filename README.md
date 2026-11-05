# ReelMatch

**Less scrolling. More watching.**

ReelMatch is a full-stack movie and TV discovery application that turns a user's favorites and viewing preferences into personalized recommendations. It combines TMDB's catalog with OpenAI-powered ranking and match analysis so users can discover what to watch next without creating an account or sorting through endless lists.

**[Live demo](https://reelmatch-01g2.onrender.com/)** · **[Repository](https://github.com/guzmanthegreat/ReelMatch)**

> **Status:** Public beta. The core guest experience is deployed on Render. Operational hardening, automated testing, and persistent user accounts are planned improvements.

## What the project demonstrates

- **Full-stack development** with React, Vite, Node.js, and Express
- **External API integration** through a server-side TMDB and OpenAI layer
- **LLM reliability patterns** that constrain the model to verified candidates
- **Streaming interfaces** using Server-Sent Events (SSE)
- **Guest-first UX** with browser persistence and no required account
- **Responsive interaction design** including search, swipeable carousels, loading states, and error handling

## Features

- **Guest-first onboarding** — Choose favorite movies or TV shows without signing up.
- **TMDB-powered search and discovery** — Search real titles, browse trending content, and explore genre-based collections.
- **Personalized recommendations** — AI ranks candidates generated from selected favorites and viewing feedback.
- **Match analysis** — Open any title to receive a spoiler-free, personalized explanation of why it may or may not fit.
- **Streaming analysis** — Match explanations appear progressively word by word through an SSE connection.
- **Taste signals** — Save favorites and react with **Loved It**, **Want to Watch**, **Already Seen**, or **Not for Me**.
- **Recommendation categories** — Results are organized into **Perfect Match**, **Highly Likely**, **Worth a Watch**, **Unlikely Match**, and **Not for You**.
- **Persistent browser state** — Favorites, reactions, and discovery history are stored in `localStorage` for the current browser.
- **Responsive carousels** — Title collections support manual scrolling, swipe gestures, and continuous browsing behavior.

Match categories are qualitative AI assessments. They are not calibrated probabilities and do not guarantee that a user will enjoy a title.

## How it works

1. The user selects favorite titles and optionally supplies preferences such as mood, pacing, and format.
2. The Express server requests recommendation candidates from TMDB based on the selected titles.
3. The server removes excluded items and sends a bounded, verified candidate pool to OpenAI.
4. OpenAI ranks only the supplied candidates and groups them into recommendation rows.
5. The server validates returned IDs against the candidate pool before the results reach the browser.
6. When the user opens a title, the server retrieves its current TMDB details and streams a personalized match explanation from OpenAI.

This candidate-grounding approach keeps the model focused on titles that actually exist in the application's data source and prevents invented recommendation IDs from being displayed.

## Architecture

```text
React + Vite client
        |
        v
Express API server  ----->  TMDB API
        |
        +------------------> OpenAI Responses API
        |
        +------------------> Server-Sent Events for streamed analysis
        |
        v
Browser localStorage/sessionStorage
```

The application is deployed as one Render web service. Express serves the built Vite frontend and exposes the `/api` routes from the same origin, avoiding a separate frontend/backend deployment for the current MVP.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, CSS |
| Backend | Node.js, Express 5 |
| Movie and TV data | TMDB API |
| AI integration | OpenAI Responses API |
| Streaming | Server-Sent Events (SSE) |
| Client persistence | `localStorage`, `sessionStorage` |
| Hosting | Render |

## Project structure

```text
ReelMatch/
├── public/              # Static icons and TMDB attribution assets
├── src/
│   ├── main.jsx         # React application and user flows
│   └── styles.css       # Responsive interface styles
├── server/
│   └── index.js         # Express API, TMDB integration, and AI routes
├── index.html
├── render.yaml          # Render deployment configuration
├── vite.config.js
└── package.json
```

## Run locally

### Prerequisites

- Node.js 22 or newer
- npm
- A [TMDB API Read Access Token](https://www.themoviedb.org/settings/api)
- An [OpenAI API key](https://platform.openai.com/api-keys) with available API credit for AI features

### Installation

```bash
git clone https://github.com/guzmanthegreat/ReelMatch.git
cd ReelMatch
npm ci --include=dev
```

Create a `.env` file in the project root. Never commit this file:

```dotenv
TMDB_READ_ACCESS_TOKEN=replace_with_your_tmdb_read_access_token
OPENAI_API_KEY=replace_with_your_openai_api_key
OPENAI_MODEL=replace_with_a_supported_model
ENABLE_PUBLIC_AI=false
PORT=3001
```

`TMDB_TOKEN` is also accepted as an alternative to `TMDB_READ_ACCESS_TOKEN`.

### Build and start

```bash
npm run build
node server/index.js
```

Then open [http://localhost:3001](http://localhost:3001). The health endpoint is available at [http://localhost:3001/api/health](http://localhost:3001/api/health).

To test AI functionality locally, set `ENABLE_PUBLIC_AI=true` and restart the server. This enables paid API requests, so it should only be used in a controlled development environment.

> `npm run dev` starts Vite's frontend development server only. Since the current Vite configuration does not proxy `/api` requests, use the build-and-start commands above for a complete local test of the deployed architecture.

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Reports service and integration status |
| `GET` | `/api/search` | Searches TMDB movies and TV shows |
| `GET` | `/api/trending` | Returns trending titles |
| `GET` | `/api/discovery` | Returns curated genre and popularity rows |
| `POST` | `/api/recommend` | Generates AI-ranked recommendation rows |
| `POST` | `/api/match/stream` | Streams a personalized match analysis over SSE |
| `POST` | `/api/match` | Returns a non-streaming match analysis |

## Prompt engineering and reliability

ReelMatch uses several controls around the OpenAI integration:

- A defined advisor persona keeps explanations friendly, persuasive, spoiler-free, and specific to the user's taste.
- Structured JSON output makes recommendation rows and categories predictable for the frontend.
- Candidate IDs are included in the prompt and validated against the server's candidate map after the response.
- Favorites and feedback are separated into positive, neutral, and negative signals.
- Match analysis uses the selected title's current TMDB details rather than relying on user-provided text.
- AI requests are gated behind an environment flag and limited in memory by IP and process-wide counters.

The recommendation endpoint asks the model to rank verified candidates only. The model does not directly call TMDB and cannot add arbitrary titles to the result set.

## Deployment

The project is configured for a single Render web service through `render.yaml`.

| Setting | Value |
| --- | --- |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `node server/index.js` |
| Health check | `/api/health` |

Set `TMDB_READ_ACCESS_TOKEN`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and `ENABLE_PUBLIC_AI` in Render's environment settings. Secrets belong in Render, not in the repository.

## Current limitations

- User profiles are browser-based; there is no account system or server-side synchronization.
- The AI request limiter is in-memory and resets when the process restarts. It is not a durable spending cap for a scaled production deployment.
- Recommendation and TMDB responses are not yet backed by a persistent cache.
- Automated integration and end-to-end test coverage should be expanded before large-scale public use.
- TMDB commercial-use and branding requirements should be reviewed before monetization.

## Roadmap

- Add optional accounts and server-side profiles
- Add durable rate limits, caching, and observability
- Expand automated API and browser testing
- Measure recommendation quality using user feedback
- Continue improving accessibility, performance, and recommendation diversity

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Movie and TV metadata and posters are provided by [TMDB](https://www.themoviedb.org/). Review TMDB's current API, attribution, and commercial-use requirements before distributing or monetizing the application.

## License

No open-source license has been selected for this repository yet. Until a license is added, the source code remains fully protected by copyright and should not be reused as if it were open source.
