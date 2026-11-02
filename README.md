# ReelMatch

**An AI-powered movie and TV recommendation application that helps users discover what to watch based on their personal taste.**

## Overview

ReelMatch helps solve a common problem: spending too much time searching for something to watch without knowing whether you'll actually enjoy it.

Instead of relying entirely on popularity or general audience ratings, ReelMatch analyzes a user's favorite movies, TV shows, and viewing preferences to generate personalized compatibility assessments.

The application uses five match categories:

- **Perfect Match** — Exceptionally strong alignment with the user's preferences.
- **Highly Likely** — Strong alignment with relatively few drawbacks.
- **Worth a Watch** — Some appealing qualities, with meaningful uncertainties.
- **Unlikely Match** — Several important mismatches.
- **Not for You** — Strong conflicts with established preferences.

These categories represent qualitative AI assessments, not statistically validated probabilities.

## Features

- **Google Authentication:** Users can sign in securely using their Google account.
- **Personalized Taste Profiles:** Users select three favorite movies or TV shows and answer three preference questions.
- **Persistent Profiles:** Firebase Firestore stores preferences so they remain available across sessions.
- **Movie and TV Search:** Search real titles using The Movie Database (TMDB) API.
- **AI Compatibility Analysis:** Receive a personalized match category and explanation.
- **Detailed Explanations:** Expand results to view additional reasoning and potential drawbacks.
- **Movie Discovery:** Explore titles recommended by TMDB based on previously selected favorites.
- **Prediction Caching:** Reuse predictions for the same movie and unchanged profile during the current application session.

## Technology Stack

| Technology              | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| React                   | Frontend user interface                   |
| Vite                    | Frontend development and build tool       |
| Node.js                 | Backend JavaScript runtime                |
| Express                 | Backend API                               |
| Firebase Authentication | Google Sign-In                            |
| Cloud Firestore         | User profile storage                      |
| TMDB API                | Movie and TV metadata and recommendations |
| OpenAI API              | AI-generated compatibility analysis       |

## How ReelMatch Works

1. The user signs in with Google.
2. The user selects three favorite movies or TV shows.
3. The user answers three questions about pacing, storytelling, and atmosphere.
4. ReelMatch saves the completed profile to Firestore.
5. The user searches for a title or browses TMDB recommendations.
6. The backend retrieves relevant movie metadata from TMDB.
7. OpenAI evaluates the title against the user's preferences.
8. ReelMatch displays a categorical match verdict, short explanation, and optional detailed analysis.

## Prompt Engineering Techniques

ReelMatch uses prompt engineering to guide its AI-generated compatibility assessments.

### 1. Persona Pattern

The AI is instructed to act as a thoughtful movie and TV recommendation advisor.

Example:

> You are ReelMatch, a thoughtful movie and TV recommendation advisor.

This establishes the AI's role and helps focus its responses on evaluating entertainment preferences rather than providing generic movie descriptions.

### 2. Few-Shot Prompting

The AI prompt contains examples showing how different viewing preferences can correspond to different match categories.

For example, a user who enjoys philosophical science fiction may receive a stronger compatibility assessment for a thought-provoking science-fiction mystery than someone who primarily prefers lighthearted comedies.

These examples demonstrate the expected classification task and help guide the model toward the defined categories.

### Additional Prompt Controls

The prompt also instructs the model to avoid inventing plot details, avoid major spoilers, account for uncertainty, and provide potential drawbacks.

Structured JSON output ensures that responses contain the fields needed by the user interface.

## Running ReelMatch Locally

### Prerequisites

- Node.js and npm
- Firebase project with Google Authentication and Firestore configured
- TMDB API Read Access Token
- OpenAI API key with available credits

### 1. Clone the Repository

```bash
git clone https://github.com/guzmanthegreat/ReelMatch.git
cd ReelMatch
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd server
npm install
```

### 4. Configure Environment Variables

Create `server/.env`:

```dotenv
TMDB_TOKEN=your_tmdb_read_access_token
OPENAI_API_KEY=your_openai_api_key
PORT=3001
```

Create `.env.local` in the project root:

```dotenv
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

Firebase Authentication must have Google Sign-In enabled, and Firestore rules must restrict each user's profile to their authenticated user ID.

Do not commit private API credentials or environment files to GitHub.

### 5. Start the Backend

From the `server` directory:

```bash
node index.js
```

The backend runs on `http://localhost:3001`.

### 6. Start the Frontend

In another terminal, from the project root:

```bash
npm run dev
```

Open the local URL displayed by Vite. The default is usually `http://localhost:5173`, but Vite may choose another available port.

The backend's CORS configuration must allow the frontend's local origin.

## Current Limitations

- Match categories are AI-generated qualitative assessments, not calibrated probabilities.
- Discovery suggestions originate from TMDB and are not automatically ranked by the AI matching model.
- Prediction caching lasts only for the current application session.
- New users must provide three favorite titles and answer three questions.
- The application currently runs in a local development environment.
- Public deployment would require additional backend authentication, rate limiting, and API usage protection.

## Future Improvements

- User ratings and feedback to refine recommendations.
- More advanced personalization and recommendation ranking.
- Watchlists and viewing history.
- Improved prediction consistency and evaluation.
- Public deployment with production-ready API security.

## Academic Project

Developed for **CS 4680 — Prompt Engineering** at California State Polytechnic University, Pomona.

The project demonstrates generative AI integration, prompt engineering patterns, personalized recommendations, API integration, and full-stack application development.
