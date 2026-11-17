# ReelMatch

### Personalized movie and TV discovery

**Less scrolling. More watching.**

[Try the live demo](https://reelmatch-01g2.onrender.com/) ·
[View the source](https://github.com/guzmanthegreat/ReelMatch)

ReelMatch is a full-stack portfolio project that helps people find something
to watch based on the movies and shows they already enjoy. It combines a
React interface, an Express API, TMDB's catalog, and OpenAI-powered
recommendations and match explanations.

## The experience

1. Pick favorite movies or TV shows and optionally set mood, pacing, and format
   preferences.
2. Browse recommendations based on real titles returned by TMDB.
3. Open any title to see a spoiler-free explanation of how it fits your taste.
4. Save favorites and record reactions to improve future recommendations.

## Engineering highlights

- **Grounded AI recommendations:** The server builds a candidate list from
  TMDB. OpenAI can rank only those candidates, and the server checks returned
  IDs before showing results.
- **Streaming responses:** Match explanations arrive progressively over
  Server-Sent Events (SSE), rather than waiting for the full response.
- **Protected integrations:** TMDB and OpenAI credentials stay on the server.
  The API validates incoming taste data and returns clear errors to the client.
- **Usage controls:** AI routes can be disabled with an environment setting
  and are limited per IP and across the server process.
- **Guest-first interface:** Favorites, preferences, reactions, and discovery
  history are saved in browser storage for the current browser session.
- **Responsive UI:** Search, loading and empty states, feedback controls, and
  reusable title carousels support the main discovery flow.

Match categories are qualitative AI assessments, not calibrated probabilities
or guarantees that a user will enjoy a title.

## Architecture

```text
Browser: React + Vite
  localStorage / sessionStorage
        | same-origin API requests
        v
   Express API -------> TMDB API
        |
        +-------------> OpenAI Responses API
        |
        +-------------> SSE stream to browser
```

The app deploys as one Render web service. Express serves the built Vite
frontend and API from the same origin, so the current project does not need a
separate frontend host or database.

## Technology

| Area | Tools |
| --- | --- |
| Frontend | React 19, Vite, CSS |
| Backend | Node.js, Express 5 |
| Movie and TV catalog | TMDB API |
| AI | OpenAI Responses API |
| Streaming | Server-Sent Events |
| Deployment | Render |

## Run locally

### Prerequisites

- Node.js 22 or newer
- npm
- A [TMDB API Read Access Token](https://www.themoviedb.org/settings/api)
- An [OpenAI API key](https://platform.openai.com/api-keys) for AI features

### Setup

```bash
git clone https://github.com/guzmanthegreat/ReelMatch.git
cd ReelMatch
npm ci --include=dev
cp .env.example .env
```

Add your TMDB token to `.env`. AI features are off locally by default. To test
them, add an OpenAI key and set `ENABLE_PUBLIC_AI=true`:

```dotenv
TMDB_READ_ACCESS_TOKEN=your_tmdb_read_access_token
OPENAI_API_KEY=your_openai_api_key
ENABLE_PUBLIC_AI=true
```

Keep real keys in `.env` or your hosting provider's environment settings. Never
put them in frontend code or commit them to the repository. `TMDB_TOKEN` is
also accepted as an alternative to `TMDB_READ_ACCESS_TOKEN`.

### Build and start the full app

```bash
npm run build
node server/index.js
```

Open [http://localhost:3001](http://localhost:3001). The server health check
is at [http://localhost:3001/api/health](http://localhost:3001/api/health).

`npm run dev` starts Vite's frontend only; it does not proxy API requests to
Express. Use the build-and-start commands above to run the complete app locally.

### Environment settings

| Variable | Purpose | Default |
| --- | --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | TMDB API credential | Not set |
| `OPENAI_API_KEY` | Enables server-side OpenAI requests | Not set |
| `OPENAI_MODEL` | OpenAI model name | `gpt-4o-mini` |
| `ENABLE_PUBLIC_AI` | Enables AI routes | `false` |
| `AI_PER_IP_LIMIT` | AI requests allowed per IP per hour | `20` |
| `AI_GLOBAL_LIMIT` | AI requests allowed across this server per hour | `500` |
| `PORT` | Express listening port | `3001` |

The request limits are in-memory safeguards, not a spending cap. OpenAI usage
can incur charges; set a budget or alert in the OpenAI project as well.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Reports server and integration status |
| `GET` | `/api/search` | Searches TMDB for movies and TV shows |
| `GET` | `/api/discovery` | Loads popular and genre-based collections |
| `POST` | `/api/recommend` | Returns AI-ranked TMDB candidates |
| `POST` | `/api/match/stream` | Streams a personalized match explanation |

## Quality checks

Run the project checks locally:

```bash
npm test
npm run lint
npm run build
```

The current automated tests focus on backend input validation and text
normalization.

## Deploy

The Render blueprint in [`render.yaml`](render.yaml) builds the frontend,
starts the Express server, and uses `/api/health` as its health check. Add
`TMDB_READ_ACCESS_TOKEN` and `OPENAI_API_KEY` in Render's environment settings.
The blueprint enables AI for the public demo, so keep its request limits and
OpenAI budget in mind.

## Current scope and next steps

- Guest data is stored in the browser; there are no accounts or cross-device
  profiles.
- AI request limits reset when the server restarts. A shared, durable limiter
  would be needed to scale the public service.
- The project has backend unit tests, but no browser end-to-end or external API
  integration suite yet.
- Caching TMDB responses and measuring recommendation quality are future
  improvements.

## Project structure

```text
ReelMatch/
├── public/               # Favicon and TMDB attribution assets
├── src/
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Shared state and screen flow
│   ├── components/       # Reusable poster and carousel
│   ├── screens/          # Welcome, onboarding, discovery, match, taste
│   ├── utils.js          # Shared title and category helpers
│   └── styles.css        # Responsive interface styles
├── server/
│   ├── index.js          # Express app and API routes
│   ├── validation.js     # Request checks and TMDB data formatting
│   ├── tmdb.js           # TMDB API requests
│   ├── ai.js             # OpenAI prompts and SSE helpers
│   ├── config.js         # Environment settings
│   ├── rateLimit.js      # In-memory AI request limits
│   └── index.test.js     # Backend validation tests
├── .env.example           # Local environment variable template
├── index.html             # HTML page Vite loads
├── render.yaml            # Render service configuration
├── vite.config.js
└── package.json
```

## Attribution and license

This product uses the TMDB API but is not endorsed or certified by TMDB.
Movie and TV metadata and posters are provided by
[TMDB](https://www.themoviedb.org/). Review TMDB's current API, attribution,
and commercial-use requirements before distributing or monetizing the app.

The project is available under the [MIT License](LICENSE). TMDB data, images,
and branding remain subject to TMDB's own terms and attribution requirements.
