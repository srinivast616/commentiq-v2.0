# CommentIQ — Development Roadmap

## MVP Definition (Phase 1)

The MVP is scoped to be genuinely buildable and demoable end-to-end, using
**YouTube URL** and **CSV/Excel upload** as the two input paths (per your
choice — YouTube first).

**In scope:**
- Auth + projects (single-owner, no team workspace yet)
- YouTube comment extraction (YouTube Data API v3) + CSV/Excel upload
- Full AI pipeline: clean → language detect → translate → sentiment →
  emotion → toxicity → topic → intent → keywords → embeddings → dedupe →
  aggregate → summarize
- Dashboard: sentiment/emotion/topic/language distributions, timeline, word
  cloud
- Comment Explorer: search + filters (sentiment, emotion, topic, language,
  date, likes)
- Chat with Comments (RAG over embeddings)
- Export: CSV, JSON, PDF
- Basic usage limits per plan (free/pro)

**Explicitly deferred** (see Future Enhancements below): every other social
platform, fake-engagement/bot scoring, rating prediction, influencer
detection, comment clustering ("N people want X"), trend detection over time,
compare mode, alerts, reply generator, AI moderation actions, semantic-search
as a standalone surface (chat subsumes it for MVP), OCR, video/subtitle
ingestion, team workspaces, Chrome extension, Slack/Discord/Zapier/n8n,
developer API, white-label, multi-tenancy.

This isn't cutting corners on the vision — it's sequencing it. Every deferred
item is a real, planned phase, not a rejected one.

## Phase-by-Phase Plan

### Phase 1 — MVP (build first)
**Goal:** a creator can paste a YouTube URL or upload a CSV and get a full
sentiment/emotion/topic dashboard + chat, end to end.

| Milestone | Deliverable |
|---|---|
| 1.1 | Repo scaffold, auth, project CRUD, DB schema migrated |
| 1.2 | YouTube extraction provider + CSV/XLSX upload provider |
| 1.3 | Pipeline stages 1–6 (clean → keywords) wired through BullMQ |
| 1.4 | Embeddings + pgvector storage, dedupe stage |
| 1.5 | Aggregation + dashboard API + dashboard UI |
| 1.6 | Executive summary generation |
| 1.7 | Comment Explorer (search/filter/table) |
| 1.8 | Chat with Comments (RAG) |
| 1.9 | Export (CSV/JSON/PDF) |
| 1.10 | Plan limits, polish, error states, empty states, loading states |

### Phase 2 — Platform breadth + intelligence depth
- Instagram, X/Twitter, TikTok, Reddit ingestion (each behind its own
  provider; Reddit first since its API is the most open, Instagram/X/TikTok
  gated by each platform's app-review/paid-tier requirements — see PRD §9)
- Fake-engagement/bot-probability scoring
- Comment clustering ("300 people asking for dark mode")
- Trend detection (sentiment/topic movement over time)
- Intent-driven views (feature requests, bug reports surfaced separately)
- Rating prediction
- Influencer/top-commenter detection
- Compare mode (video vs video, brand vs brand)
- Alerts (negative-sentiment spike, spam spike, new topic emergence)
- Reply generator (professional/friendly/funny/marketing/technical tones)
- AI moderation suggestions (delete/hide/reply/pin/ignore)
- Excel/PowerPoint/Markdown export formats

### Phase 3 — Platform completeness + collaboration + ecosystem
- Facebook, LinkedIn ingestion
- OCR for comment screenshots
- Video/audio upload with subtitle extraction
- Team workspaces, roles, permissions, shared reports
- Public developer API + API keys, webhooks
- Chrome/browser extension
- Slack, Discord integrations
- Zapier, n8n connectors
- White-label support, multi-tenancy

## Sequencing Rationale

1. **YouTube + CSV first** because they're the only two input paths with
   dependable, low-friction API/no-API access — every other platform either
   needs app review, has paid API tiers, or has no public comment-read API at
   all (LinkedIn). Building the pipeline against these two means the core AI
   value is provable before spending time on platform-specific scraping
   quirks.
2. **Depth features (clustering, trend detection, bot scoring, compare,
   alerts) come after breadth's first platform**, not before, because they
   need a working pipeline and real data volume to tune against — building
   them against zero live data risks over-fitting to assumptions.
3. **Collaboration and ecosystem features (teams, extensions, integrations)
   are last** because they're additive to a working single-user product, not
   prerequisites for it — a solo creator gets full value from Phase 1 alone.

## Immediate Next Step

If/when you're ready to move from planning to code, the natural next
conversation is: *"build the Phase 1 MVP"* — starting with the repo scaffold
and the YouTube extraction + CSV upload providers, since those unblock every
downstream pipeline stage.
