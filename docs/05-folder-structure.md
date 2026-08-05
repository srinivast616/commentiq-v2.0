# CommentIQ — Folder Structure

Monorepo layout (e.g. managed with pnpm workspaces / Turborepo), so frontend,
backend, and shared types stay in sync.

```
commentiq/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── (marketing)/
│   │   │   │   ├── page.tsx          # Landing page
│   │   │   │   └── pricing/page.tsx
│   │   │   ├── (auth)/
│   │   │   │   └── login/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── projects/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [projectId]/
│   │   │   │   │       ├── page.tsx          # Analysis overview
│   │   │   │   │       ├── comments/page.tsx # Comment Explorer
│   │   │   │   │       ├── chat/page.tsx     # Chat with Comments
│   │   │   │   │       └── reports/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   ├── profile/page.tsx
│   │   │   │   ├── billing/page.tsx
│   │   │   │   └── admin/page.tsx
│   │   │   └── api/                  # Next.js route handlers (BFF layer)
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui primitives
│   │   │   ├── charts/               # Recharts wrappers (sentiment, emotion, etc.)
│   │   │   ├── comment-table/        # TanStack Table comment explorer
│   │   │   ├── dashboard/            # Dashboard cards, word cloud, heatmap
│   │   │   └── chat/                 # Chat UI
│   │   ├── hooks/                    # React Query hooks per resource
│   │   ├── lib/                      # API client, utils, formatting
│   │   ├── styles/
│   │   └── types/                    # Generated/shared API types
│   │
│   └── api/                          # Node/Express backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── projects/
│       │   │   │   ├── projects.controller.ts
│       │   │   │   ├── projects.service.ts
│       │   │   │   └── projects.routes.ts
│       │   │   ├── extraction/
│       │   │   │   ├── extraction.controller.ts
│       │   │   │   ├── extraction.service.ts
│       │   │   │   ├── providers/
│       │   │   │   │   ├── youtube.provider.ts
│       │   │   │   │   └── csv-upload.provider.ts
│       │   │   │   └── extraction.routes.ts
│       │   │   ├── analysis/
│       │   │   │   ├── analysis.controller.ts
│       │   │   │   ├── analysis.service.ts
│       │   │   │   └── analysis.routes.ts
│       │   │   ├── dashboard/
│       │   │   ├── comments/
│       │   │   ├── chat/
│       │   │   ├── reports/
│       │   │   └── auth/
│       │   ├── ai/
│       │   │   ├── ai-provider.interface.ts   # swappable LLM interface
│       │   │   ├── prompts/
│       │   │   │   ├── sentiment.prompt.ts
│       │   │   │   ├── emotion.prompt.ts
│       │   │   │   ├── toxicity.prompt.ts
│       │   │   │   ├── topic.prompt.ts
│       │   │   │   ├── intent.prompt.ts
│       │   │   │   ├── summary.prompt.ts
│       │   │   │   └── chat.prompt.ts
│       │   │   └── embeddings/
│       │   │       └── embedding.service.ts
│       │   ├── pipeline/
│       │   │   ├── stages/
│       │   │   │   ├── extract.stage.ts
│       │   │   │   ├── clean.stage.ts
│       │   │   │   ├── detect-language.stage.ts
│       │   │   │   ├── translate.stage.ts
│       │   │   │   ├── classify.stage.ts
│       │   │   │   ├── extract-keywords.stage.ts
│       │   │   │   ├── embed.stage.ts
│       │   │   │   ├── dedupe.stage.ts
│       │   │   │   ├── aggregate.stage.ts
│       │   │   │   └── summarize.stage.ts
│       │   │   └── pipeline.orchestrator.ts
│       │   ├── queue/
│       │   │   ├── bullmq.config.ts
│       │   │   └── workers/               # one worker file per stage
│       │   ├── db/
│       │   │   ├── prisma/
│       │   │   │   └── schema.prisma
│       │   │   └── repositories/          # one repo per aggregate (comments, projects, ...)
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts
│       │   │   ├── rate-limit.middleware.ts
│       │   │   └── error-handler.middleware.ts
│       │   ├── config/
│       │   ├── utils/
│       │   └── server.ts
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── shared-types/                  # zod schemas + TS types shared web <-> api
│   ├── eslint-config/
│   └── tsconfig/
│
├── docker-compose.yml                 # local Postgres + Redis + api + web
├── turbo.json
├── package.json
└── README.md
```

## Rationale

- **`ai/prompts` as discrete files**: each classification concern (sentiment,
  emotion, toxicity, etc.) is its own versioned prompt file, so prompt
  iteration doesn't require touching pipeline orchestration code.
- **`pipeline/stages` mirrors the AI Pipeline diagram exactly** (see
  `02-system-architecture.md` §3) — one file per stage, one BullMQ job type
  per stage, so the roadmap-to-code mapping stays legible.
- **`providers/` under `extraction`**: each platform (YouTube now, others in
  Phase 2) implements a shared `SourceProvider` interface, so adding
  Instagram/TikTok/etc. later is "add a provider file," not "restructure the
  module."
- **Monorepo + shared-types package**: keeps the REST contract in
  `04-api-specification.md` enforced by shared zod schemas rather than hand
  duplicated types on both ends.
