# Garage Log

Private car maintenance tracker. Username + password login, data stored in Postgres (Neon), hosted on Vercel.

The first account created becomes the owner; after that, registration is closed.

## Deploy

1. Put this folder on GitHub (or skip GitHub and use `npx vercel` from this folder).
2. In Vercel: **Add New → Project**, import the repo. No build settings needed.
3. In the project: **Storage → Create → Neon (Postgres)** and connect it to the project.
   This adds `DATABASE_URL` automatically. Tables are created on first request.
4. **Settings → Environment Variables**: add `AUTH_SECRET` = any long random string
   (e.g. run `openssl rand -hex 32`). Apply to Production, Preview, Development.
5. Redeploy (Deployments → ⋯ → Redeploy), open the site, create your account.

## Files

- `index.html` — the whole frontend
- `api/auth.js` — register / login / logout / session check
- `api/vehicles.js`, `api/logs.js` — your data
- `api/_lib.js` — database + session helpers
