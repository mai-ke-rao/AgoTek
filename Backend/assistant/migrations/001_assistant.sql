-- Assistant tables. Lives in the same Postgres as IOT's rules domain, but is
-- migrated by Backend (assistant/migrate.js, own tracking table) so the two
-- services never share a migration history. IOT's drizzle.config.ts filters
-- these tables out.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id            serial PRIMARY KEY,
  source_key    text NOT NULL UNIQUE,      -- PDF file name; idempotent ingest key
  title         text NOT NULL,
  source_url    text,                      -- public link if known; else served from /manuals
  language      text,
  publisher     text,
  year          integer,
  owner_user_id text,                      -- NULL = shared corpus; else private to that user
  page_count    integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id              bigserial PRIMARY KEY,
  document_id     integer NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- Denormalized from documents so the per-user filter is applied in the same
  -- scan as the vector search (no join before ORDER BY ... LIMIT).
  owner_user_id   text,
  chunk_index     integer NOT NULL,
  page_start      integer NOT NULL,
  page_end        integer NOT NULL,
  content         text NOT NULL,           -- original text (often Cyrillic), shown and cited
  content_hash    text NOT NULL UNIQUE,    -- sha256(source_key + content)
  embedding       vector(384) NOT NULL,
  embedding_model text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks (document_id, chunk_index);
CREATE INDEX IF NOT EXISTS chunks_owner_idx ON chunks (owner_user_id);

CREATE TABLE IF NOT EXISTS rag_query_log (
  id                 bigserial PRIMARY KEY,
  created_at         timestamptz NOT NULL DEFAULT now(),
  question           text NOT NULL,
  lang               text NOT NULL,
  top_similarity     real,
  chunks_used        integer NOT NULL DEFAULT 0,
  path               text NOT NULL CHECK (path IN ('short_circuit', 'answered', 'partial', 'insufficient', 'error')),
  pesticide_flag     boolean NOT NULL DEFAULT false,
  removed_paragraphs integer NOT NULL DEFAULT 0,
  removed_doses      integer NOT NULL DEFAULT 0,
  latency_ms         integer,
  gemini_error       text,
  tools_used         text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS rag_query_log_path_idx ON rag_query_log (path, created_at);

-- A rule the assistant proposed. Stored server-side so the user confirms
-- exactly what was validated; the client only sends the id back.
CREATE TABLE IF NOT EXISTS assistant_rule_proposals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  rule        jsonb NOT NULL,              -- IOT POST /api/rules body
  summary     text NOT NULL,
  warnings    jsonb NOT NULL DEFAULT '[]',
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'confirming', 'confirmed', 'rejected', 'failed')),
  rule_id     integer,                     -- IOT rules.id once confirmed
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  decided_at  timestamptz
);
CREATE INDEX IF NOT EXISTS assistant_rule_proposals_user_idx ON assistant_rule_proposals (user_id, created_at);
