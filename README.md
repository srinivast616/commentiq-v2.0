# CommentIQ — Phase 1 MVP

A working, runnable slice of the full CommentIQ vision (see `/docs` for the
complete PRD, architecture, schema, API spec, and roadmap): paste a YouTube
video URL or upload a CSV/Excel comment export, and get AI-generated
sentiment, emotion, topic, and toxicity analysis, an executive summary, a
filterable comment explorer, and a "chat with your comments" Q&A — all
running against a real (if intentionally simplified) end-to-end pipeline.

```
commentiq-mvp/
├── apps/
│   ├── api/     Node/Express + TypeScript + Prisma(Postgres/Neon) backend
│   └── web/     Next.js + Tailwind frontend
└── docs/        The six planning documents from the prior session
```

## Quickstart

Requires Node.js 20+ and a free [Neon](https://neon.com) Postgres project.

**1. Start the API:**
```bash
cd apps/api
npm install
cp .env.example .env              # paste your Neon DATABASE_URL + DIRECT_URL (see apps/api/README.md)
npx prisma migrate dev --name init
npm run seed                      # creates demo@commentiq.dev / password123
npm run dev                       # http://localhost:4000
```

**2. Start the frontend** (in a second terminal):
```bash
cd apps/web
npm install
cp .env.local.example .env.local
npm run dev                       # http://localhost:3000
```

**3. Open http://localhost:3000, sign in with `demo@commentiq.dev` /
`password123`, create a project, and either:**
- paste a YouTube video URL (requires `YOUTUBE_API_KEY` in `apps/api/.env`), or
- upload a CSV/XLSX with at least a `comment` (or `text`) column.

With `AI_PROVIDER=mock` (the default), the whole pipeline runs with zero AI
API keys and zero AI cost — useful for exploring the product before spending
anything on real AI calls. (You still need a Neon connection string either
way — see `apps/api/README.md` for exactly where to find it in the Neon
Console.)

## Switching to real AI

```bash
# apps/api/.env
AI_PROVIDER="anthropic"
ANTHROPIC_API_KEY="sk-ant-..."
```

Every classification, summary, and chat answer will then come from real
Claude calls instead of the deterministic mock heuristics. See
`apps/api/src/ai/providers/anthropic.provider.ts` for the exact prompts.

## What's real vs. simplified in this MVP

This is a genuinely working full-stack app, not a facade — but it makes
deliberate simplifications versus the full production architecture
(`docs/02-system-architecture.md`) so it runs with **zero external infra**:

| Full architecture | This MVP | Why |
|---|---|---|
| BullMQ + Redis job queue | In-process queue (`src/queue/queue.ts`) | No Redis to stand up locally; the swap point is one file, documented inline. |
| Postgres + pgvector | Postgres (Neon) is in place; embeddings still use a local hashing vector (`src/ai/embeddings.ts`) | The DB itself is real Postgres now — pgvector is a straightforward next step (enable the extension in Neon, add a vector column). Real embeddings still need a dedicated embedding model, since Anthropic has no embeddings endpoint and adding a second AI vendor was out of scope for Phase 1. |
| Clerk/Auth.js | Hand-rolled JWT auth | No external auth account needed to run this locally. |
| Rendered PDF reports | Formatted plaintext with a `.pdf` extension | Avoids a heavy PDF-rendering dependency for a first release; the content model is already exactly what a real renderer would consume. |
| Instagram/TikTok/X/Reddit/Facebook/LinkedIn ingestion | YouTube + CSV/XLSX only | Per the roadmap's sequencing — these platforms need app-review/paid-tier API access CommentIQ doesn't control yet. |
| Fake-engagement scoring, comment clustering, trend detection, compare mode, alerts, reply generator, moderation actions, rating prediction, influencer detection, team workspaces, OCR, video/subtitle ingestion, integrations | Not built | Explicitly Phase 2/3 in the roadmap — this session scoped to Phase 1 only. |

Every simplification above has an inline code comment at its exact swap
point, so extending this into Phase 2 is additive, not a rewrite.

## Verified

- `apps/web` builds cleanly with `next build` (verified during this build).
- `apps/api` installs and runs; full TypeScript validation of the Prisma
  layer requires `prisma generate` to successfully download its query-engine
  binary, which needs open internet access (this happens automatically on
  first `npm install` / `prisma migrate dev` in a normal environment).

## Project & API docs

See `/docs` for the six planning documents generated in the prior session:
PRD, system architecture, database schema, API specification, folder
structure rationale, and the phased roadmap this MVP was scoped against.
