# ReelMatch Render deployment

This package contains no private credentials. Do not upload `.env` or secret values to GitHub.

1. Push the contents of this folder to your GitHub repository.
2. In Render, choose **New > Blueprint**, connect the repository and approve `render.yaml`.
3. Enter `TMDB_READ_ACCESS_TOKEN` and `OPENAI_API_KEY` in Render's secure environment-variable prompts. Verify `OPENAI_MODEL` is supported by your account before enabling AI.
4. Deploy and open the generated `onrender.com` URL. Test `/api/health` and movie search.

**Security:** `ENABLE_PUBLIC_AI=false` is intentional. Public visitors can search TMDB, but `/api/recommend` and `/api/match` return 403 until server-side guest identity, durable per-user quotas, and a global spending safeguard are implemented and tested. Do not switch this to true just to make AI work publicly. In-memory IP throttling in the original Beta is insufficient to protect a paid public endpoint.

Render free services may spin down after inactivity and have other restrictions. Check Render's current terms and availability before deploying. Review TMDB attribution and commercial use terms before monetization.
