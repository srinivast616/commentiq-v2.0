# CommentIQ API (Phase 1 MVP)

Node/Express + TypeScript backend implementing the extraction → AI pipeline →
dashboard/chat/export flow described in the planning docs, scoped to:

- **Input**: YouTube video URL, or CSV/XLSX comment upload.
- **AI**: pluggable provider — `mock` (deterministic, zero-cost, runs the
  whole pipeline offline) or `anthropic` (real Claude calls).
- **Queue**: in-process (no Redis/BullMQ required to run this locally) —
  see `src/queue/queue.ts` for the documented swap point to real BullMQ.
- **DB**: Postgres via Prisma, hosted on [Neon](https://neon.com) — see
  setup below.

## Set up your Neon database

1. Create a free project at [neon.com](https://neon.com) (or open an
   existing one).
2. In the Neon Console, go to **Connection Details** and copy two strings:
   - **Pooled connection** (hostname contains `-pooler`) → this is your
     `DATABASE_URL`
   - **Direct connection** (no `-pooler` in the hostname) → this is your
     `DIRECT_URL`
3. Paste both into `apps/api/.env` (see `.env.example`).

Both are needed because Neon's pooled connection runs in a mode that
doesn't support the schema-changing statements (`CREATE TABLE`, etc.)
Prisma's migrations issue — `DIRECT_URL` routes migrations around the
pooler, while the app's normal queries use the pooled `DATABASE_URL`.

## Run locally

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL / DIRECT_URL from Neon
npx prisma migrate dev --name init
npm run seed                  # creates demo@commentiq.dev / password123
npm run dev                   # http://localhost:4000
```

To use real Claude calls instead of the mock provider:

```bash
# in .env
AI_PROVIDER="anthropic"
ANTHROPIC_API_KEY="sk-ant-..."
```

To enable YouTube URL ingestion (optional — CSV upload works without this):

```bash
# in .env
YOUTUBE_API_KEY="your-youtube-data-api-v3-key"
```

## Deploying (Railway/Render/Fly.io)

This API needs a host that supports a long-running Node process — it will
**not** run correctly as Vercel serverless functions, because of the
in-process job queue (see below). Whichever host you use, set the same env
vars as `.env.example`, including `WEB_ORIGIN` pointed at your deployed
frontend's URL (needed for CORS), and run:

```bash
npx prisma migrate deploy && npm start
```

(`migrate deploy` is the non-interactive form used in the `Dockerfile` —
`migrate dev` will hang waiting for input in a CI/deploy environment.)

## Endpoints

See `../../docs/04-api-specification.md` for the full contract. Quick health
check: `GET /health`.

## What's simplified vs. the full architecture doc (by design, documented in code)

- Job queue is in-process, not BullMQ+Redis (`src/queue/queue.ts`).
- Vector search uses a local hashing-based embedding, not pgvector/Pinecone
  (`src/ai/embeddings.ts`) — because Anthropic has no embeddings endpoint and
  adding a second AI vendor just for embeddings was out of scope for Phase 1.
  (Now that the DB is Postgres, pgvector is a straightforward next step —
  enable the extension in Neon, add a `vector` column, and swap the
  similarity function in `embeddings.ts`.)
- PDF export is a formatted plaintext stand-in, not a rendered PDF
  (`src/modules/reports/reports.service.ts`).
- Auth is hand-rolled JWT, not Clerk/Auth.js, to avoid an external account
  dependency for local development.

Every one of these has an inline comment at its exact swap point.

