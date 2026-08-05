# CommentIQ — Database Schema

Normalized relational schema, designed for Prisma/PostgreSQL. Written here as
table definitions (Prisma-schema-style pseudocode); the actual `schema.prisma`
would be generated from this during implementation.

## Entity Relationship Summary

```
User ──< Project ──< Source (video/post/upload)
                         │
                         └──< Comment ──< CommentAnalysis (1:1)
                         └──< Topic (many:many via CommentTopic)
Project ──< Report
Project ──< ChatSession ──< ChatMessage
User ──< ApiKey
User ──< Subscription ──< UsageRecord
Project ──< TeamMembership >── User   (Phase 3: team workspaces)
```

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| email | text, unique | |
| name | text | |
| auth_provider_id | text | Clerk/Auth.js external ID |
| plan | enum(free, pro, business) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `projects`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id | owner |
| name | text | |
| description | text, nullable | |
| status | enum(pending, processing, ready, failed) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `sources`
One row per ingested video/post/upload; a project can technically hold more
than one source for "compare" use cases (Phase 2).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| project_id | uuid, FK → projects.id | |
| platform | enum(youtube, instagram, facebook, x, linkedin, reddit, tiktok, csv_upload) | |
| source_url | text, nullable | null for uploads |
| file_path | text, nullable | Supabase Storage path, for uploads |
| external_id | text, nullable | e.g. YouTube video ID |
| title | text, nullable | |
| fetched_comment_count | int | |
| fetch_status | enum(pending, running, done, failed) | |
| created_at | timestamptz | |

### `comments`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| source_id | uuid, FK → sources.id | |
| external_comment_id | text, nullable | platform's own comment ID, if any |
| username | text | |
| author_is_verified | boolean | |
| text_original | text | |
| text_translated | text, nullable | English translation, if applicable |
| language_code | varchar(10), nullable | |
| like_count | int | default 0 |
| reply_count | int | default 0 |
| posted_at | timestamptz, nullable | |
| is_duplicate | boolean | default false |
| duplicate_of_comment_id | uuid, nullable, FK → comments.id | |
| created_at | timestamptz | ingestion time |

Indexes: `(source_id)`, `(language_code)`, `(posted_at)`, full-text index on
`text_translated`.

### `comment_analysis`
One-to-one with `comments`; separated from the base comment row so the
pipeline can write analysis results independently and so this table can be
wide without bloating the base comment table.

| Column | Type | Notes |
|---|---|---|
| comment_id | uuid, PK, FK → comments.id | |
| sentiment_label | enum(positive, neutral, negative) | |
| sentiment_confidence | float | 0–1 |
| sentiment_score | float | normalized -1..1 |
| emotions | jsonb | e.g. `{"joy": 0.8, "anger": 0.05, ...}` |
| toxicity_flags | jsonb | e.g. `{"spam": false, "hate_speech": false, "profanity": true, ...}` |
| toxicity_confidence | jsonb | per-flag confidence |
| intent | enum(question, complaint, suggestion, praise, purchase_intent, support_request, bug_report, feature_request, other) | |
| predicted_rating | smallint, nullable | 1–5, Phase 2 |
| bot_probability | float, nullable | Phase 2 |
| embedding_id | text, nullable | reference into vector store |
| moderation_suggestion | enum(delete, hide, reply, pin, ignore, none), nullable | |
| analyzed_at | timestamptz | |

### `topics`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| project_id | uuid, FK → projects.id | topics are scoped per project (AI-generated names, not a fixed taxonomy) |
| name | text | |
| description | text, nullable | |
| comment_count | int | denormalized count, refreshed on aggregation |
| created_at | timestamptz | |

### `comment_topics`
Many-to-many join (a comment can touch more than one topic).

| Column | Type | Notes |
|---|---|---|
| comment_id | uuid, FK → comments.id | |
| topic_id | uuid, FK → topics.id | |
| relevance_score | float | |

PK: `(comment_id, topic_id)`

### `keywords`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| project_id | uuid, FK → projects.id | |
| term | text | |
| type | enum(keyword, hashtag, person, organization, location, product, brand) | |
| frequency | int | |

### `reports`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| project_id | uuid, FK → projects.id | |
| format | enum(pdf, csv, xlsx, json, markdown, pptx) | |
| file_path | text | Supabase Storage path |
| generated_at | timestamptz | |
| requested_by | uuid, FK → users.id | |

### `chat_sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| project_id | uuid, FK → projects.id | |
| user_id | uuid, FK → users.id | |
| created_at | timestamptz | |

### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| session_id | uuid, FK → chat_sessions.id | |
| role | enum(user, assistant) | |
| content | text | |
| cited_comment_ids | uuid[], nullable | comments the answer drew on |
| created_at | timestamptz | |

### `api_keys` (developer API, Phase 3)
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id | |
| key_hash | text | never store raw key |
| label | text | |
| created_at | timestamptz | |
| revoked_at | timestamptz, nullable | |

### `subscriptions`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id | |
| plan | enum(free, pro, business) | |
| status | enum(active, canceled, past_due) | |
| billing_provider_id | text | e.g. Stripe subscription ID |
| current_period_end | timestamptz | |

### `usage_records`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id | |
| metric | enum(comments_analyzed, api_calls, exports) | |
| quantity | int | |
| period_start | date | |
| period_end | date | |

### `team_memberships` (Phase 3)
| Column | Type | Notes |
|---|---|---|
| project_id | uuid, FK → projects.id | |
| user_id | uuid, FK → users.id | |
| role | enum(owner, editor, viewer) | |

PK: `(project_id, user_id)`

## Design Notes

- **Why `comment_analysis` is a separate table from `comments`**: keeps the
  hot ingestion path (writing raw comments fast) decoupled from the slower
  AI-analysis writes, and lets the pipeline mark analysis progress per comment
  without locking the base row.
- **Why `topics` are per-project, not global**: topic names are AI-generated
  and contextual ("Dark Mode requests" only makes sense for a software
  product's comments); a global fixed taxonomy would fight the "AI-generated
  topic names" requirement.
- **Why embeddings aren't stored as a Postgres column here**: they live in the
  vector store (pgvector table or Pinecone index); `comment_analysis.embedding_id`
  just references them, keeping this table lean and letting the vector backend
  be swapped independently.
- **Soft multi-tenancy for MVP**: `team_memberships` is Phase 3; in the MVP,
  `projects.user_id` is the sole ownership check, which is simpler and
  sufficient until team workspaces are needed.
