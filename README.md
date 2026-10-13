# Smart Exam Planner

Smart Exam Planner is an academic planning platform for students. It combines Prisma-backed persistence and server-side Gemini AI to support syllabus planning, PYQ analysis, quizzes, and study tracking.

## Tech stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- AI: Google Gemini (server side only)
- Auth: JWT + bcrypt
- Validation: Zod

## Project structure

- `frontend/` — React app
- `backend/` — Express API
- `prisma/` — Prisma schema and migrations
- `.env.example` — root env template
- `frontend/.env.example` — frontend env template
- `backend/.env.example` — backend env template
- `DEPLOYMENT.md` — deployment instructions

## Setup

Copy the example environment files and fill in your real values:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Required backend values:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`

`GEMINI_API_KEY` is optional and enables AI-provider features. In production,
the frontend and API share an origin, so `VITE_API_BASE_URL` can remain unset;
set it only when using a separately hosted API.

## Local development

Run the full app:

```bash
npm run dev
```

Frontend URL:
- http://localhost:5173

Backend URL:
- http://localhost:5000

## Build and test

```bash
npm run build
npm run test
```

## Health checks

Backend health endpoints:

- `GET /`
- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/ai`

## Production notes

- Do not expose `GEMINI_API_KEY` in frontend code.
- Keep secrets in backend-only deployment env vars.
- Use `FRONTEND_URL` for CORS in production.
- Use Prisma migrations for database changes.

## Deployment

See `DEPLOYMENT.md` for full deployment instructions.
