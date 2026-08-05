# CommentIQ — API Specification (MVP)

Base URL: `/api/v1`. Auth: Bearer session token (Clerk/Auth.js) on every
route unless noted. All responses are JSON. Errors follow:

```json
{ "error": { "code": "string", "message": "string" } }
```

---

## Projects

### `POST /projects`
Create a project.
```json
// request
{ "name": "Q3 Launch Video" }
// response 201
{ "id": "uuid", "name": "Q3 Launch Video", "status": "pending", "created_at": "..." }
```

### `GET /projects`
List the caller's projects (paginated: `?page=1&limit=20`).

### `GET /projects/:id`
Fetch a single project with its sources and status.

---

## Extraction / Analysis

### `POST /extract`
Kick off comment extraction for a project. Two supported bodies:

```json
// YouTube URL
{ "project_id": "uuid", "platform": "youtube", "source_url": "https://youtube.com/watch?v=..." }
```
```json
// File upload (multipart/form-data, not JSON)
// fields: project_id, platform=csv_upload, file=<binary>
```
Response 202 (async — extraction runs as a background job):
```json
{ "source_id": "uuid", "fetch_status": "running", "job_id": "uuid" }
```

### `POST /analyze`
Trigger (or re-trigger) the AI pipeline for a source once extraction is
complete. Usually called automatically after extraction, exposed separately
so re-analysis is possible.
```json
{ "source_id": "uuid" }
```
Response 202:
```json
{ "job_id": "uuid", "status": "queued" }
```

### `GET /jobs/:job_id`
Poll job/pipeline progress (used by the frontend during extraction/analysis).
```json
{
  "job_id": "uuid",
  "stage": "classify",
  "stages_completed": ["extract", "clean", "detect-language", "translate"],
  "progress_pct": 62,
  "status": "running"
}
```

---

## Dashboard & Results

### `GET /dashboard?project_id=uuid`
Aggregate stats for a project's dashboard.
```json
{
  "sentiment_distribution": { "positive": 0.61, "neutral": 0.24, "negative": 0.15 },
  "emotion_distribution": { "joy": 0.4, "anger": 0.1, "...": 0.0 },
  "topic_distribution": [{ "topic": "Pricing", "count": 340 }],
  "language_distribution": [{ "language": "en", "count": 1200 }],
  "timeline": [{ "date": "2026-07-01", "positive": 40, "neutral": 10, "negative": 5 }],
  "total_comments": 1523,
  "toxicity_summary": { "spam": 32, "hate_speech": 4, "profanity": 18 }
}
```

### `GET /summary?project_id=uuid`
The AI-generated executive summary.
```json
{
  "executive_summary": "string",
  "overall_opinion": "string",
  "top_positive_points": ["..."],
  "top_negative_points": ["..."],
  "suggestions": ["..."],
  "common_complaints": ["..."],
  "appreciated_features": ["..."]
}
```

### `GET /topics?project_id=uuid`
List AI-generated topics with counts and representative comments.

### `GET /comments?project_id=uuid&...filters`
Paginated comment explorer. Query params: `sentiment`, `emotion`, `topic`,
`language`, `date_from`, `date_to`, `min_likes`, `search` (keyword/full-text),
`page`, `limit`, `sort`.
```json
{
  "data": [
    {
      "id": "uuid",
      "username": "string",
      "text_original": "string",
      "text_translated": "string",
      "language": "es",
      "like_count": 12,
      "reply_count": 2,
      "posted_at": "...",
      "sentiment": { "label": "negative", "confidence": 0.87 },
      "emotions": { "anger": 0.6, "disappointment": 0.3 },
      "topics": ["Pricing"],
      "intent": "complaint",
      "toxicity_flags": { "profanity": true }
    }
  ],
  "page": 1,
  "total": 1523
}
```

---

## Chat with Comments

### `POST /chat`
Ask a natural-language question over a project's comments (RAG over
embeddings + LLM answer).
```json
// request
{ "project_id": "uuid", "session_id": "uuid | null", "question": "What do people dislike most?" }
// response
{
  "session_id": "uuid",
  "answer": "string",
  "cited_comment_ids": ["uuid", "uuid"]
}
```

---

## Export

### `POST /export`
```json
{ "project_id": "uuid", "format": "pdf" }
```
Response 202 (report generation is async for pdf/xlsx/pptx; csv/json may
return inline for small sets):
```json
{ "report_id": "uuid", "status": "generating" }
```

### `GET /reports/:report_id`
```json
{ "report_id": "uuid", "status": "ready", "download_url": "https://..." }
```

---

## Compare (Phase 2 — included here for forward compatibility)

### `POST /compare`
```json
{ "project_id_a": "uuid", "project_id_b": "uuid" }
```

---

## Conventions

- All list endpoints are paginated (`page`, `limit`, default `limit=20`, max `100`).
- All long-running operations (`/extract`, `/analyze`, `/export` for
  pdf/xlsx/pptx) return `202 Accepted` with a job/report ID; the client polls
  `GET /jobs/:job_id` or `GET /reports/:report_id`.
- Rate limits are enforced per plan (e.g. free: 5 projects, 2k comments/month;
  pro: higher tiers) and returned via `429` with a `Retry-After` header.
- All project-scoped endpoints verify `project.user_id === session.user_id`
  (or team membership, once Phase 3 ships) before returning any data.
