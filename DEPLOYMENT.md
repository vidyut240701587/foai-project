# Deployment Guide

The frontend and Express API are deployed together as one Vercel project. The
frontend calls `/api` on the same origin; no separate API host or public
`VITE_API_BASE_URL` is needed.

## 1. Provision PostgreSQL

Create a managed PostgreSQL database (for example, on Neon or another provider).
Use a database that is dedicated to this app. The local `.env` database points
to `localhost` and is not reachable from Vercel.

Set `DATABASE_URL` to the provider's production connection string in the
`smart-exam-planner` Vercel project's Production environment. Use a pooled
connection URL if the provider recommends one for serverless applications.

## 2. Configure Vercel environment variables

In **Project Settings → Environment Variables**, add:

- `DATABASE_URL` — the managed PostgreSQL connection URL.
- `JWT_SECRET` — a random secret with at least 32 characters; do not reuse a
  development or example value.
- `FRONTEND_URL` — `https://smart-exam-planner-nine.vercel.app` (the exact
  production origin, without a trailing slash).
- `GEMINI_API_KEY` — optional; needed for AI features only.
- `GEMINI_MODEL` — optional; defaults to the model configured by the backend.

Keep all credentials in Vercel's server-side environment variables. Never use
`VITE_` names for secrets. Redeploy after changing Production environment
variables.

## 3. Initialize the database

The initial Prisma migration is in `prisma/migrations`. Before applying it,
confirm the target database is new or has been safely backed up; do not run the
initial migration against a database containing untracked application tables.

Run the migration with the production `DATABASE_URL` available to the local
command, for example from a PowerShell session:

```powershell
$env:DATABASE_URL = 'your managed PostgreSQL connection URL'
npm run db:migrate:deploy
Remove-Item Env:DATABASE_URL
```

Do not save a production URL in a committed file. Prisma Client is generated
as part of installation/build, and the migration must complete before users
register.

## 4. Deploy

The Vercel project root is the repository root. Its `vercel.json` runs
`npm run build`, publishes `frontend/dist`, serves the Express API from the
`api/` serverless function, and routes client-side frontend paths to
`index.html`.

The production site is:

- <https://smart-exam-planner-nine.vercel.app>

## 5. Verify production

- `GET /` serves the frontend.
- `GET /api/health` reports the database as connected.
- Register and log in with a test account.
- Complete onboarding and confirm dashboard data persists after signing out
  and back in.
- If `GEMINI_API_KEY` is configured, verify `GET /api/health/ai` and an AI
  request.
