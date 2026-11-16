# ReelMatch Render deployment

This package contains no private credentials. Do not upload `.env` or secret values to GitHub.

1. Push the contents of this folder to your GitHub repository.
2. In Render, choose **New > Blueprint**, connect the repository and approve `render.yaml`.
3. Enter `TMDB_READ_ACCESS_TOKEN`, `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` in Render's secure environment-variable prompts. Leave `ENABLE_PUBLIC_AI=false` until you have configured Redis quotas and a provider-level spending limit. Verify `OPENAI_MODEL` is supported by your account before enabling AI.
4. Deploy and open the generated `onrender.com` URL. Test `/api/health` and movie search.

**Security:** `ENABLE_PUBLIC_AI=false` is intentional. Public visitors can search TMDB, but `/api/recommend` and `/api/match` remain disabled until Redis credentials, durable quotas, and a provider-level spending safeguard are configured. Do not enable public AI with `ALLOW_IN_MEMORY_AI_LIMITS=true`.

Render free services may spin down after inactivity and have other restrictions. Check Render's current terms and availability before deploying. Review TMDB attribution and commercial use terms before monetization.
