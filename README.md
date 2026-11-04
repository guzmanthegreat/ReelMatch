# ReelMatch

**Less scrolling. More watching.**

ReelMatch is an AI-powered movie and TV discovery app that helps you decide what to watch next. Pick titles you love, optionally describe your mood, and get personalized suggestions drawn from real titles in [The Movie Database (TMDB)](https://www.themoviedb.org/).

**[Try ReelMatch live](https://reelmatch-01g2.onrender.com/)**

> **Project status:** Public beta. The core user journey has been tested on the live Render deployment. Some security and operational improvements are still planned.

## Features

- **Guest-first onboarding:** Start without creating an account.
- **Movie and TV search:** Find real titles with TMDB posters and metadata.
- **Trending titles:** Browse what's popular this week.
- **Personalized discovery:** OpenAI ranks a set of verified TMDB candidates based on favorites, optional preferences, and feedback.
- **Check a Match:** Evaluate a specific title against your taste and get a short, spoiler-conscious explanation.
- **Five match categories:** Perfect Match, Highly Likely, Worth a Watch, Unlikely Match, and Not for You.
- **Taste and reactions:** Save favorites and mark recommendations **Loved It**, **Want to Watch**, **Already Seen**, or **Not for Me**.
- **Saved local preferences:** Your taste, feedback, and recommendation history are stored in your browser.

Match categories are **qualitative AI assessments**, not calibrated probabilities or guarantees of enjoyment.

## How it works

1. Choose one or more favorite movies or TV shows.
2. Optionally answer questions about mood, pacing, and preferred format.
3. ReelMatch gathers real recommendation candidates and metadata from TMDB.
4. The backend asks OpenAI to rank those verified candidates and explain the picks.
5. React displays posters, match categories, and explanations; your feedback informs later requests.

The AI is instructed to rank **provided candidates only**, rather than invent titles. The backend checks returned IDs against its candidate pool before displaying them.

## Tech stack

| Layer | Technology |
| --- | --- |
| Interface | React, Vite, CSS |
| API server | Node.js, Express |
| Movie and TV data | TMDB API |
| Personalized analysis | OpenAI Responses API |
| Preference storage | Browser `localStorage` |
| Deployment | Render (one web service for frontend and backend) |

The repository may still contain legacy Firebase-related dependencies or files. The current guest-first experience does **not** require Firebase sign-in or Firestore profile storage.

## Run locally

### Prerequisites

- Node.js 22 or newer and npm
- A [TMDB API Read Access Token](https://www.themoviedb.org/settings/api)
- An [OpenAI API key](https://platform.openai.com/api-keys) with API access and available credit, for AI features

### Install

```bash
git clone https://github.com/guzmanthegreat/ReelMatch.git
cd ReelMatch
npm ci --include=dev
```

Create a `.env` file **in the project root** (do not commit it):

```dotenv
TMDB_READ_ACCESS_TOKEN=replace_with_your_tmdb_read_access_token
OPENAI_API_KEY=replace_with_your_openai_api_key
OPENAI_MODEL=replace_with_a_supported_model_available_to_your_account
ENABLE_PUBLIC_AI=false
PORT=3001
```

The backend also accepts `TMDB_TOKEN` as an alternative to `TMDB_READ_ACCESS_TOKEN`.

### Build and run

```bash
npm run build
node server/index.js
```

Open **http://localhost:3001**. This runs the built React frontend and Express API together, matching the single-service deployment architecture. You can check the backend at **http://localhost:3001/api/health**.

To test AI locally, set `ENABLE_PUBLIC_AI=true` in your local `.env` and restart the server. This enables paid API requests; use only in a controlled development environment.

> `npm run dev` starts the Vite frontend alone. The current Vite configuration does not proxy `/api` requests, so use the production-style local commands above for full-stack testing.

## Deployment

ReelMatch is deployed as a single Render web service. The repository includes `render.yaml` with the build command, start command, and health-check path.

| Setting | Value |
| --- | --- |
| Build | `npm ci --include=dev && npm run build` |
| Start | `node server/index.js` |
| Health check | `/api/health` |

Configure `TMDB_READ_ACCESS_TOKEN`, `OPENAI_API_KEY`, and `OPENAI_MODEL` in **Render → Environment**, not in GitHub. `ENABLE_PUBLIC_AI` controls whether the paid AI routes are available to visitors. The blueprint defaults this flag to `false`; confirm the deployed setting after any Blueprint changes.

**Security note:** The current AI limiter uses in-memory per-IP and global counters. These reset when the process restarts and are **not** a persistent spending cap. Review dependency audit warnings and strengthen abuse protection before broad promotion or scaling.

## Prompt engineering

ReelMatch uses a **persona pattern** to guide the AI as a playful, spoiler-conscious movie advisor. It also uses **structured-output constraints** to request predictable JSON containing match categories, title IDs, and explanations. The prompts distinguish favorites from feedback such as **Want to Watch** and **Not for Me**.

The current recommendation prompts do not establish a full few-shot or iterative-refinement implementation; those are possible future improvements.

## Roadmap

- Persistent server-side guest profiles and optional accounts
- Durable, abuse-resistant AI quotas and request caching
- Automated integration and end-to-end tests
- Improved recommendation diversity and feedback evaluation
- Accessibility and performance refinements
- Monetization only after licensing and operational review

## TMDB attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

Movie and TV metadata and posters are provided by [TMDB](https://www.themoviedb.org/). The website should display TMDB's official logo and attribution in accordance with TMDB's applicable branding and API terms. Review TMDB's commercial-use licensing before monetizing ReelMatch.

## Academic context

ReelMatch was developed as an AI assistant MVP for **CS 4680 — Prompt Engineering** at Cal Poly Pomona, with the longer-term goal of becoming a usable consumer product.

## Repository

Source code: [github.com/guzmanthegreat/ReelMatch](https://github.com/guzmanthegreat/ReelMatch)
