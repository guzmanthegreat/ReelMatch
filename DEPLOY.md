# ReelMatch Render deployment

This package contains no private credentials. Do not upload `.env` or secret values to GitHub.

1. Push the contents of this folder to your GitHub repository.
2. In Render, choose **New > Blueprint**, connect the repository and approve `render.yaml`.
3. Enter `TMDB_READ_ACCESS_TOKEN`, `OPENAI_API_KEY`, and `OPENAI_MODEL` in Render's secure environment-variable prompts. The beginner blueprint enables AI with an in-memory limiter.
4. Deploy and open the generated `onrender.com` URL. Test `/api/health` and movie search.

**Security:** The beginner blueprint uses a simple in-memory limiter so the demo works without an extra database. The limit resets when the server restarts, so add a durable limiter and an OpenAI project spending limit before treating this as a high-traffic production service.

Render free services may spin down after inactivity and have other restrictions. Check Render's current terms and availability before deploying. Review TMDB attribution and commercial use terms before monetization.
