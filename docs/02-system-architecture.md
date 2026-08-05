# CommentIQ — System Architecture

## 1. High-Level Architecture

```
                              ┌─────────────────────────┐
                              │   Next.js Frontend      │
                              │  (React, TS, Tailwind,  │
                              │  Shadcn UI, Recharts)   │
                              └───────────┬─────────────┘
                                          │ HTTPS / REST
                              ┌───────────▼─────────────┐
                              │   API Gateway / BFF      │
                              │  (Next.js API routes or  │
                              │   Express edge layer)    │
                              └───────────┬─────────────┘
                                          │
                 ┌────────────────────────┼──────────────────────────┐
                 │                        │                          │
        ┌────────▼────────┐    ┌─────────▼──────────┐     ┌─────────▼─────────┐
        │  Core API        │    │  Job Queue (BullMQ) │     │  Auth Service      │
        │  (Node/Express,  │    │  + Redis            │     │  (Clerk / Auth.js) │
        │  TypeScript)     │    └─────────┬──────────┘     └────────────────────┘
        └────────┬─────────┘              │
                 │                        │
      ┌──────────▼─────────┐   ┌──────────▼───────────┐
      │  PostgreSQL          │   │  Worker Processes     │
      │  (Prisma ORM)         │   │  (extraction + AI     │
      │                       │   │   pipeline stages)    │
      └───────────────────────┘   └──────────┬───────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                ┌─────────▼────────┐ ┌────────▼────────┐ ┌────────▼─────────┐
                │  YouTube Data API │ │  AI Provider API │ │  Vector DB        │
                │  v3               │ │  (LLM: sentiment,│ │  (pgvector /      │
                │                   │ │  emotion, topic,  │ │  Pinecone) for    │
                │                   │ │  summary, chat)   │ │  embeddings +     │
                │                   │ │                   │ │  semantic search  │
                └───────────────────┘ └───────────────────┘ └───────────────────┘

Supporting infra: Supabase Storage (file uploads, exports), Redis (cache +
queue backend), logging/monitoring (e.g. OpenTelemetry + a hosted sink).
```

## 2. Component Responsibilities

### Frontend (Next.js)
- Server-rendered pages for SEO-relevant surfaces (landing, pricing).
- Client-rendered app shell for the authenticated dashboard (React Query for
  data fetching/caching, TanStack Table for the comment explorer, Recharts for
  visualizations, Framer Motion for transitions).
- Talks only to the API Gateway — never directly to Postgres, Redis, or
  external APIs.

### API Gateway / BFF
- Auth verification (session/JWT from Clerk or Auth.js).
- Rate limiting per user/plan.
- Request validation (zod schemas shared with frontend types).
- Routes requests to the Core API; owns no business logic itself.

### Core API (Node/Express + TypeScript)
- Owns all business logic: projects, analysis jobs, comment queries, chat,
  exports, billing hooks.
- Talks to PostgreSQL via Prisma.
- Enqueues long-running work (extraction, AI pipeline stages) onto BullMQ
  rather than doing it inline — analysis of large comment sets must not block
  an HTTP request.
- Exposes the REST endpoints defined in `04-api-specification.md`.

### Worker Processes
- Consume BullMQ jobs in discrete pipeline stages (see AI Pipeline section
  below). Each stage is its own job type so failures are isolated and
  retryable per-stage rather than restarting the whole pipeline.
- Write results incrementally to Postgres so the dashboard can show partial
  progress while a large job is still running.

### PostgreSQL (via Prisma)
- System of record for all structured data: users, projects, comments,
  analysis results, reports.
- See `03-database-schema.md` for full schema.

### Vector Database (pgvector to start; Pinecone if scale demands it)
- Stores comment embeddings for semantic search and the "chat with comments"
  RAG flow.
- Starting with pgvector (same Postgres instance) avoids operating a second
  database in the MVP; migration path to Pinecone is a swap behind a small
  repository interface, not a rewrite.

### Redis
- BullMQ's backing store.
- General caching layer (dashboard aggregates, rate-limit counters).

### External AI Provider
- LLM calls for: sentiment/emotion/toxicity/topic/intent classification
  (batched prompts over grouped comments), embeddings generation,
  summarization, and the chat-with-comments Q&A.
- Abstracted behind an internal `AIProvider` interface so the underlying model
  can be swapped without touching pipeline code.

## 3. AI Pipeline (Detailed)

```
1. Extract comments
   → YouTube Data API (commentThreads.list, paginated) OR CSV/XLSX parse
2. Normalize & clean text
   → strip control chars, normalize whitespace, optionally strip emoji
     (configurable per project)
3. Language detection
   → fast language-ID model (e.g. fastText/lingua) per comment
4. Translation
   → translate non-English comments to English for unified analysis;
     original text retained in the DB alongside the translation
5. Batch classification pass (LLM, grouped prompts, JSON-mode output)
   → sentiment (label + confidence)
   → emotion (multi-label + confidence)
   → toxicity subtype flags + confidence
   → intent classification
   → topic assignment (against a dynamically-grown topic set for the project)
6. Keyword/entity extraction
   → frequency-based keyword extraction + NER (people, orgs, locations,
     products, hashtags)
7. Embedding generation
   → one embedding per comment, written to the vector store
8. Duplicate/spam clustering
   → near-duplicate detection via embedding similarity + exact-text hashing
9. Aggregation
   → roll up per-comment results into project-level stats (sentiment
     distribution, topic distribution, emotion graph, timeline buckets)
10. Summarization
    → single LLM call over the aggregated stats + a representative sample of
      comments (not all raw comments, to control token cost) produces the
      executive summary, top positives/negatives, complaints, suggestions
11. Report generation (on-demand, not part of the automatic pipeline)
    → PDF/CSV/JSON export assembled from stored aggregate + comment data
```

Each numbered stage is a separate BullMQ job type (`extract`, `clean`,
`detect-language`, `translate`, `classify`, `extract-keywords`, `embed`,
`dedupe`, `aggregate`, `summarize`). Stages 3–8 run comment-batch-parallel
where possible; stage 10 runs once per completed job.

## 4. Scalability & Reliability Notes

- **Backpressure**: extraction jobs for very large comment sets (10k+) are
  chunked into sub-jobs so a single video doesn't monopolize the worker pool.
- **Retry strategy**: each pipeline stage job has exponential-backoff retries;
  a stage that permanently fails for a subset of comments marks those comments
  `unclassified` rather than failing the whole project.
- **Caching**: dashboard aggregate reads are cached in Redis with short TTL
  and invalidated on new pipeline writes.
- **Rate limiting**: per-plan request limits enforced at the API Gateway;
  YouTube API quota usage tracked per-account to avoid one user exhausting a
  shared quota (or use per-user API keys on paid tiers).
- **Observability**: structured logs per pipeline stage with job/project IDs;
  metrics on stage duration, failure rate, and queue depth feed monitoring.
- **Security**: encrypted secrets (AI provider keys, YouTube API keys) via a
  secrets manager, not env files in source; row-level access checks in the
  Core API for every project/comment query (a user can only ever query their
  own project's data).

## 5. Deployment

- Frontend + API Gateway: Vercel.
- Core API + Workers: containerized (Docker), deployed to a container host
  (e.g. Fly.io/Render/ECS — chosen at implementation time based on
  cost/ops preference); Workers scale independently from the API since job
  load and request load have different profiles.
- PostgreSQL: managed Postgres (e.g. Supabase/RDS) with pgvector extension
  enabled.
- Redis: managed Redis (e.g. Upstash) for both cache and BullMQ.
