-- Hybrid retrieval: a keyword index next to the vector index.
-- search_text is the chunk folded to lowercase ASCII Latin (ingest fills it
-- with text.foldForMatch), so Cyrillic manuals match Latin queries.
-- 'simple' config: no stemming (Postgres has none for Serbian); queries use
-- prefix terms instead (see text.searchTerms).
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS search_text text;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(search_text, ''))) STORED;
CREATE INDEX IF NOT EXISTS chunks_search_tsv_idx ON chunks USING gin (search_tsv);
