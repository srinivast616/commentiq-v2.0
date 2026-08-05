# CommentIQ — Product Requirements Document (PRD)

## 1. Overview

**CommentIQ** is a SaaS platform that ingests comments from YouTube videos and social
posts (or user-uploaded CSV/Excel files) and uses AI to turn raw comment noise into
structured audience intelligence: sentiment, emotion, topics, intent, toxicity,
trends, and natural-language answers to questions like *"what do people dislike
most?"*

**Primary users:** content creators, social media managers, brand/marketing teams,
researchers, political analysts, community moderators.

**Core value proposition:** turn thousands of unstructured comments into an
actionable report in under a minute, without manual reading.

## 2. Problem Statement

Creators and brands accumulate comments faster than any human can read them.
Existing platform-native comment views offer no sentiment, no clustering, no
trend detection, and no way to ask questions of the data. Manual moderation and
audience research is slow, subjective, and doesn't scale past a few hundred
comments.

## 3. Goals

- Ingest comments from a URL (YouTube first) or a file upload in one action.
- Run a single AI pipeline that produces sentiment, emotion, topic, intent,
  toxicity, and keyword signals for every comment.
- Summarize the whole set into an executive-style report a human can read in
  two minutes.
- Let users interrogate the comment set conversationally ("chat with comments").
- Present everything in a fast, filterable, exportable dashboard.

## 4. Non-Goals (explicitly out of scope for MVP)

- Real-time / streaming comment ingestion (MVP is on-demand, not live-polling).
- Non-YouTube platform scraping (Instagram, TikTok, LinkedIn, Reddit, X/Twitter)
  — deferred to Phase 2+ due to each platform's distinct API/ToS constraints
  (see §9 and the Roadmap doc for platform-by-platform notes).
- Chrome extension, Slack/Discord bots, Zapier/n8n, white-label, multi-tenancy —
  all bonus features, deferred.
- OCR of comment screenshots, video/subtitle ingestion — deferred.

These are retained in the full product vision (see `06-roadmap-mvp.md` §Future
Enhancements) but excluded from the buildable MVP so the first release is
something that actually ships and works end-to-end.

## 5. User Personas

| Persona | Need |
|---|---|
| YouTube creator | "Should I be worried about this video's comments? What's the mood?" |
| Brand/marketing manager | "How did our campaign post land? Compare to the last one." |
| Community moderator | "Which comments are toxic/spam and need action?" |
| Researcher/analyst | "What are people saying about topic X across many comments, and can I export it?" |

## 6. Feature Set (mapped to build phases)

### Phase 1 — MVP (this is what gets built first)
1. **Input**: YouTube video URL, or CSV/Excel upload of comments.
2. **Extraction**: username, comment text, timestamp, like count, reply count,
   detected language (via YouTube Data API for URL input; direct parse for
   file upload).
3. **AI Sentiment Analysis**: positive/neutral/negative + confidence + overall
   score.
4. **Emotion Detection**: joy, love, excitement, anger, fear, disgust, sadness,
   surprise, confusion, sarcasm, hope, disappointment.
5. **Toxicity Detection**: spam, hate speech, profanity, threats, bullying,
   offensive language, personal attacks (political/religious abuse and
   fake/bot subtypes flagged at reduced confidence in MVP — full accuracy
   needs a dedicated classifier, see Roadmap).
6. **Topic Detection**: AI-generated topic clusters (not a fixed taxonomy).
7. **Keyword Extraction**: frequent terms, hashtags, named entities.
8. **AI Executive Summary**: overall opinion, top positives/negatives,
   suggestions, common complaints.
9. **Chat with Comments**: ask natural-language questions, answered by
   retrieval over the comment embeddings.
10. **Language Detection + Translation**: detect language, translate to English
    for unified analysis, keep original text alongside.
11. **Duplicate/Spam Detection**: near-duplicate clustering.
12. **Dashboard**: sentiment/emotion/topic/language charts, word cloud,
    timeline.
13. **Search & Filters**: by keyword, sentiment, emotion, topic, language, date,
    user, likes.
14. **Export**: CSV, JSON, and PDF report.
15. **Basic auth, projects, and usage limits** (single-tenant-per-account,
    not full team workspace yet).

### Phase 2
- Instagram, X/Twitter, TikTok, Reddit ingestion (each via their own official
  API where available; platforms without a viable public API are flagged as
  "manual CSV export only").
- Fake-engagement/bot-probability scoring, comment clustering ("300 people
  want dark mode"), trend detection over time.
- Intent detection, rating prediction, influencer/top-commenter detection.
- Excel/PowerPoint/Markdown report exports.
- Reply generator, AI moderation suggestions.
- Compare mode (video vs video, brand vs brand, before vs after).
- Alerts (spike in negative sentiment/spam/new topic).

### Phase 3
- Facebook, LinkedIn ingestion.
- OCR for screenshot uploads.
- Video/audio subtitle extraction and analysis.
- Team workspaces, roles/permissions, white-label, multi-tenancy.
- Chrome extension, Slack/Discord integrations, Zapier/n8n, public developer API,
  webhooks.

## 7. Success Metrics

- Time from "paste URL" to "dashboard populated" (target: < 60s for 1,000
  comments).
- % of comments successfully classified (target: > 98%, remainder flagged
  "unclassified" rather than silently dropped).
- Chat-with-comments answer relevance (human-rated sample).
- Weekly active projects per account (engagement proxy).

## 8. Key Risks & Constraints

- **Platform API access**: YouTube Data API v3 has quota limits and does not
  return every comment for very high-volume videos without pagination cost;
  Instagram/TikTok/LinkedIn have much stricter or no public comment-read APIs
  — most will require the user's own developer app credentials or manual
  export, which affects UX and must be set expectations for.
- **AI cost at scale**: per-comment LLM calls are expensive at 10k+ comments;
  MVP batches comments into grouped prompts and uses cheaper
  classification-tuned calls for sentiment/emotion, reserving full LLM calls
  for summarization and chat.
- **Toxicity/hate-speech accuracy**: nuanced categories (political/religious
  abuse, sarcasm) are inherently harder to classify reliably; MVP surfaces
  confidence scores rather than binary labels for these.
- **Multi-language accuracy**: translation-before-analysis can lose nuance
  (sarcasm, idioms); flagged as a known limitation, not silently hidden.

## 9. Platform Ingestion Feasibility Notes

| Platform | MVP-viable ingestion path |
|---|---|
| YouTube | YouTube Data API v3 (`commentThreads.list`) — official, quota-based. **Phase 1.** |
| CSV/Excel | Direct file parse — no API dependency. **Phase 1.** |
| Instagram | Graph API (business/creator accounts only, requires app review) — Phase 2, with CSV fallback. |
| X/Twitter | API v2 has paid tiers with comment/reply access limits — Phase 2, with CSV fallback. |
| TikTok | Limited official comment API access — Phase 2, with CSV fallback. |
| Reddit | Public API (PRAW/Reddit API) — comparatively open — Phase 2. |
| Facebook | Graph API, page-owned content only — Phase 3. |
| LinkedIn | No general public comment API — Phase 3, CSV-only realistically. |

This table exists so the roadmap doesn't over-promise: several "just enter a
URL" flows from the original spec depend on platform API grants CommentIQ
doesn't control yet.
