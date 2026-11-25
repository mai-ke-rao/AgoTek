# AgroTek Assistant — Grounded Answers Spec (v2, as built)

Revision of *AgroTek RAG – Grounded Answers Spec* (Nov 6, 2026) after mapping it
onto the code. The behavior the spec asks for is kept; where the spec was wrong
about the codebase or the corpus, or where a literal reading would have hurt,
the change and the reason are listed in **§9 Changes from v1**.

## 1. What it is

A chat assistant (circle, bottom right, logged-in users only) that answers from

- **farming manuals** — RAG over pgvector, tagged `[S1]…`
- **the user's own AgoTek data** — parcels, activity log (Knjiga polja), IoT
  devices and telemetry (Mongo), automation rules and their fire history
  (Postgres) — via tools, tagged `[D1]…`

and **proposes automation rules** that are created only after the user presses
Confirm. Every claim cites a source, weak retrieval short-circuits to "not in my
sources", and quantities are blocked unless they appear in the cited source.

## 2. Trust boundary

The model sits outside it.

| Concern | Enforcement (server) |
|---|---|
| Whose data | `userId` comes from the verified JWT only. Tools have no user parameter; extra args are stripped by Zod. |
| Retrieval | `WHERE owner_user_id IS NULL OR owner_user_id = $user` is in the same SQL as `ORDER BY embedding <=> $q LIMIT k` (pgvector ≥ 0.8 iterative scan so filtering doesn't starve k). |
| Every tool | Zod-validated args; each query in `assistant/dataAccess.js` is scoped by user; devices/parcels/rules are looked up *with* the user filter, so "not yours" and "doesn't exist" are indistinguishable. |
| Rule creation | `propose_rule` → Zod (same grammar as IOT) → ownership of every dev_id → stored server-side as `pending` (30 min). Confirm → re-validate → re-check ownership → IOT `POST /api/rules` with the user's JWT, `enabled: false`. IOT validates and checks ownership again, transactionally. Atomic claim prevents double creation. |
| Prompt injection | Tool output and passages are declared data in the prompt; nothing the model says is executed except read tools and pending proposals. |

## 3. Stack

| Concern | Decision |
|---|---|
| Where | `Backend/assistant/` (Render). Reads Mongo directly; reads Postgres (shared with IOT) directly; writes rules only through IOT's API. |
| Embeddings | `EMBEDDING_PROVIDER=gemini` (default): `gemini-embedding-001` through the Gemini API, 768 dims (`outputDimensionality`), `RETRIEVAL_QUERY` / `RETRIEVAL_DOCUMENT` task types, normalized; nothing loaded in the process (Backend ~90 MB RSS). `EMBEDDING_PROVIDER=local`: `Xenova/multilingual-e5-small` via transformers.js (`dtype: q8`, 384 dims, ~500 MB RSS; a devDependency, for offline work). **Both sides transliterated Cyrillic → Latin before embedding.** Question embeddings are cached in memory. |
| Vector store | pgvector, cosine, HNSW (`vector_cosine_ops`). |
| LLM | Gemini via `@google/genai`: `GEMINI_MODEL`, then `GEMINI_FALLBACK_MODELS` in order. Function calling in `ANY` mode; the final answer is a `final_answer` call whose parameter schema is the structured-output contract, parsed with Zod. |
| Tests | `node:test` (no new test deps). Unit tests mock Gemini, retrieval, Mongo, Postgres. |

## 4. Answer pipeline (`assistant/agent.js`)

```
question ─ pesticide flag (keywords, deterministic)
         ─ embed (query:) → top RAG_TOP_K → keep similarity ≥ RAG_MIN_SIMILARITY
         ─ nothing passed AND no history AND no data-intent keyword
              → fixed "not in my sources" (points to PSSS), Gemini NOT called   [short_circuit]
         ─ agent loop (≤ ASSISTANT_MAX_STEPS, last step may only call final_answer)
              passages that passed are given up front as [S1..Sk]
              tools: search_manuals (gate inside: {sufficient:false, chunks:[]}),
                     list_parcels, get_activities, list_devices, get_telemetry,
                     list_rules, get_rule_history, propose_rule
         ─ final_answer → Zod; malformed/missing → insufficient
         ─ validateCitations → guardDoses → disclaimer if flagged
```

Only the gate, citation validation and the dose check can stop an answer. Every
path writes one `rag_query_log` row.

### Prompt rules
1. Answer only from the numbered sources ([S] and [D]); no outside knowledge.
2. Every factual sentence ends with its tag(s); untagged text is deleted.
3. Partial coverage → `partial` + `missing`.
4. Not covered → `insufficient`, empty answer. `sufficient:false` from search means don't answer from memory.
5. Answer in the language of the question (passages may be Cyrillic).
6. Copy numbers exactly; never estimate/convert/round/calculate quantities.
Flagged: "Never state a product name, dose, concentration, application rate or waiting period unless it appears in a source. Never estimate, convert or round one."
Rules: never claim a rule was created; it's a proposal until Confirm and starts disabled.

### validateCitations (pure)
1. Grouped tags (`[S1, S3]`, `[S1-S3]`) normalized; a tag is valid only if it names a source sent in this request; invalid tags removed.
2. Paragraphs/list items without a valid tag are dropped; headings exempt, but dropped when nothing survives under them.
3. Anything dropped → status at most `partial`; nothing tagged left → `insufficient`.
4. Citations built from tags still in the final answer (after the dose guard).

### guardDoses (pure, every answer)
- Quantity = number (or range: both ends) followed by ml, l, g, kg, mg, t, %, ‰, ppm, mm, cm, m³, dana/days (Latin and Cyrillic). Near karenca/PHI/pre-harvest/waiting period, every number counts.
- Normalization: `0,5 = 0.5`, grouped thousands (`1.000`, `1 000`), thin/no-break spaces; tag digits and list numbers ignored.
- Each number must occur in a source **that paragraph cites**. Manuals: exact. Data: may be rounded to the precision shown.
- Otherwise the paragraph (list marker kept) becomes the fixed notice; counted in `flags.removedDoses`; status at most `partial`.
- Flagged questions always end with the fixed sr/en disclaimer — including `insufficient` answers.

### API — `POST /api/assistant/ask` (JWT)
Request `{ question, lang?: 'sr'|'en', history?: [{role, text}] ≤ 10 }`.
```
{ status: 'answered'|'partial'|'insufficient', answer, missing: string[],
  citations: { tag, kind: 'manual'|'data', documentTitle, page|null, pageEnd|null,
               sourceUrl|null, snippet }[],
  flags: { pesticideTopic, removedParagraphs, removedDoses },
  proposals: { id, summary, warnings, expiresAt }[],
  meta: { topSimilarity, chunksUsed, tools } }
```
Gemini 429 or per-user limit (`ASSISTANT_RATE_LIMIT_PER_MIN`) → **429** `{ error: 'rate_limited', message }`; other failures → **503**. Never 500.
`POST /api/assistant/proposals/:id/confirm|reject`, `GET /api/assistant/status`.

UI: `[Sn]`/`[Dn]` render as chips → title, page, snippet and a link (PDF at
`#page=N`, or the in-app page for data). Proposals render as Confirm/Reject cards.

## 5. Ingestion (`npm run ingest -- [dir] [--only x] [--owner userId]`, local only)

1. pdfjs-dist page by page, line geometry kept, 1-based PDF page index (what `#page=` opens). Pages with almost no text are reported (scanned → need OCR).
2. Clean: drop lines repeated in the top/bottom 3 lines of ≥ 30 % of pages and bare page numbers; join `-` line-break hyphenation (only before lowercase); collapse whitespace; merge paragraphs continuing across a page break.
3. Chunk: headings and paragraphs first; ~350 tokens counted with the real tokenizer, ~60-token sentence overlap (none across a heading); oversize paragraphs split by sentence, then by word; never across documents; `page_start`/`page_end` recorded.
4. Embed with `passage:`; 5. upsert by `content_hash = sha256(source_key + content)`; hashes already stored with the current model are not re-embedded; chunks no longer produced are deleted. Re-runs are no-ops.

Metadata (title, publisher, year, language, optional public URL) comes from `Agricultural_resources/sources.json`.

## 6. Schema (`Backend/assistant/migrations`, applied at startup and by `npm run db:migrate`, tracked in `assistant_migrations`)

| Table | Columns |
|---|---|
| documents | id, source_key (unique), title, source_url, language, publisher, year, owner_user_id, page_count, created_at |
| chunks | id, document_id (FK cascade), owner_user_id, chunk_index, page_start, page_end, content, content_hash (unique), embedding vector(`EMBEDDING_DIM`; 384 in migration 001, resized by ingest), embedding_model, search_text + generated search_tsv (GIN), created_at — HNSW cosine index |
| rag_query_log | id, created_at, question, lang, top_similarity, chunks_used, path (short_circuit\|answered\|partial\|insufficient\|error), pesticide_flag, removed_paragraphs, removed_doses, latency_ms, gemini_error, tools_used |
| assistant_rule_proposals | id (uuid), user_id, rule (IOT body), summary, warnings, status, rule_id, error, created_at, expires_at, decided_at |

Startup: if any stored `embedding_model` ≠ `EMBEDDING_MODEL`, the assistant is
disabled with the reason logged (routes 503). Model swap = truncate `chunks`, re-ingest.

## 7. Logging and eval

`npm run eval` (by hand, not CI) runs `Backend/eval/questions.json` — 30
answerable / 10 out-of-corpus / 10 pesticide, Serbian (Latin and Cyrillic) and
English mixed — and prints pass rate per group and the top-similarity
distribution of answerable vs out-of-corpus questions. Set
`RAG_MIN_SIMILARITY` between the two distributions; the per-provider default
(gemini 0.62, local 0.80) is only the start.
Questions logged as `short_circuit`/`insufficient` are the shopping list for
the next PDFs.

## 8. Acceptance criteria

Unit (`npm test`, Gemini mocked):
- [x] Out-of-corpus question → `insufficient`, Gemini never called.
- [x] Mocked reply citing `[S9]` with 5 sources sent → tag removed, untagged paragraph dropped.
- [x] No valid tags at all → `insufficient`.
- [x] Dose not in the cited chunk → fixed notice; one that is there passes.
- [x] Pesticide-flagged answers always end with the disclaimer.
- [x] Malformed final answer → `insufficient`; Gemini 429 → 429 "try again shortly", never 500.
- [x] Tools only read the JWT user's data; foreign device → no read; proposals never create rules.

Integration (`npm run test:integration`, real Postgres + model):
- [ ] Serbian (Latin and Cyrillic) and English fertigation questions retrieve *Primena đubriva u višegodišnjim zasadima*.
- [ ] Ingest is idempotent. (Mismatch fail-fast is covered by a unit test of the startup check.)
- [ ] Another user's private document is never retrieved.

Eval: ≥ 9/10 out-of-corpus abstain; 10/10 pesticide questions flagged with
disclaimer (no ungrounded dose can pass `guardDoses`); answerable pass rate
recorded as the baseline.

## 9. Changes from v1 (and why)

1. **There was no existing assistant.** v1 says "read the existing agent loop, RAG tool, chunk table, system prompt"; none existed (`Chat.jsx` was an unconnected stub). Built from scratch in `Backend/assistant/`, keeping v1's names where they map (`validateCitations`, `pesticideKeywords`, `rag_query_log`, `/api/assistant/ask`). Files are `.js`, not `.ts`, because Backend is plain CommonJS with no build step on Render.
2. **Cyrillic corpus.** Three of the four PDFs are Serbian Cyrillic; users type Latin, often without diacritics. Both passages and queries are transliterated to Latin before embedding; the stored/cited text stays original. Keyword matching folds Cyrillic, case and diacritics.
3. **Agent mode vs. "Gemini is never called".** v1 wants both an agent and no Gemini call on weak retrieval. A question about the user's own telemetry or rules always fails the manual gate, so a hard short-circuit would make data questions impossible. Resolution: short-circuit only when the gate fails **and** there is no conversation history **and** no deterministic data-intent keyword (`dataIntent.js`, leaning toward matching). Otherwise the agent runs, and the citation check still blocks anything ungrounded.
4. **`[D]` data sources.** "Every claim must cite a chunk" would forbid answers about the user's own data. Tool results are registered as `[Dn]` sources and validated exactly like `[Sn]`; the dose check allows rounding for data only.
5. **Structured output via `final_answer` function** instead of `responseMimeType` + `responseSchema`, which Gemini doesn't reliably accept together with function declarations. Same schema, same Zod parse, same "parse failure = insufficient".
6. **Out-of-corpus examples were in the corpus.** "Tractor gearbox repair" and "dairy cow feed" are covered by *Poljoprivredne mozgalice – 1000 zašto, 1001 zato* (tractors, IMT 539, calves, dairy). The eval uses genuinely unrelated questions (crypto, phones, recipes…).
7. **No plum manual exists.** The acceptance criterion now uses fertigation and *Primena đubriva u višegodišnjim zasadima*; the answerable eval set was written from the actual tables of contents.
8. **`doz` stem** matched *dozrevanje/dozreva* (ripening) and *dozvola*; replaced by dose word forms. **`phi`** is whole-word only (it matched *phosphorus*, *graphic*). Added *sredstvo/zaštita bilja* and a few more real active substances.
9. **Number check widened**: ranges check both ends; units extended to mg, t, ppm, ‰, mm, cm, m³, days and Cyrillic forms (irrigation norms and tillage depths are where invented numbers appear); numbers near karenca count without a unit. Notice reworded from "Dose not shown" to cover all amounts.
10. **Fail fast without taking down login.** An embedding-model mismatch disables the assistant (503 + logged reason) instead of crashing Backend, which also serves auth, parcels and activities.
11. **`content_hash` includes the source file**, so identical boilerplate in two PDFs doesn't make one document lose a chunk; stale chunks are deleted so re-chunking can't leave orphans.
12. **Per-user retrieval filter** (`owner_user_id`) added so private documents can be ingested (`--owner`) without leaking.
13. **Page numbers are PDF page indices**, not printed page numbers, so `#page=N` links open the right page.
14. **Migrations**: the assistant tables share IOT's Postgres but use their own migration table; IOT's `drizzle.config.ts` now scopes drizzle-kit to the automation tables; local compose uses `pgvector/pgvector:pg16`.
15. **Tables of contents and references sections are not indexed** (found on the first real ingest). TOC pages (dot-leader lines, e.g. Mozgalice's 30-page question list) and bibliographies list every topic of a book, so as chunks they outranked the real passage for most questions, and English reference titles won every English question. `ingest/clean.js` drops dot-leader lines, everything from a references heading (*Литература*, *Literatura*, *References*…, the word alone) to the next heading or prose, blocks that look like citation entries (two or more "Surname, X." authors), and pages that are mostly references (two-column bibliographies leave fragments).
16. **Hybrid retrieval** (found on the first real ingest). With e5-small, a rare decisive term is diluted by the generic words around it: the fertigation chapter ranked 12th by vector alone for "Kako se izvodi fertigacija u voćnjaku?". A keyword index (`chunks.search_tsv` over the text folded to ASCII Latin, migration 002) is ranked by IDF over prefix terms and fused with the vector ranking (reciprocal rank fusion). The similarity gate is unchanged: only chunks whose *vector* similarity passes `RAG_MIN_SIMILARITY` are returned. The prompt tells the model to re-search in Serbian for English questions.
17. **Gemini resilience** (found on the first live calls). `gemini-2.5-flash` is no longer available to new keys. Each call has a deadline (`GEMINI_TIMEOUT_MS`, 30 s). Models are tried in order (`GEMINI_MODEL`, then `GEMINI_FALLBACK_MODELS`): overload gets one retry, then overload/timeout/quota move to the next model; a model that failed is skipped for a while (2 min, or the quota's own retry delay); if every model is only over a per-minute limit, the shortest wait (≤ 20 s) is waited out. The model that answered is tried first for the rest of the question (thought signatures are model-specific).
18. **Embeddings through the Gemini API instead of e5-small in-process.** Measured: the quantized e5-small costs ~470–530 MB RSS in Backend, which does not fit a 512 MB Render instance. `gemini-embedding-001` costs no memory, and separates relevant from irrelevant far better on this corpus (≈0.73 / 0.57 / 0.40 for relevant / same-domain / unrelated, where e5 gave 0.85–0.88 for everything). The local model stays as `EMBEDDING_PROVIDER=local`. `chunks.embedding` is resized by `npm run ingest` when `EMBEDDING_DIM` changes (startup only resizes an empty table).
19. **Free-tier limits are part of the design** (measured Nov 2026): embeddings 30,000 tokens/min and 1,000 texts/day (so the first ingest of ~2,900 chunks takes three days; it stops with "ingest paused" and resumes where it stopped; every question costs one); `gemini-3.5-flash` 5 requests/min and 20/day; `gemini-3.7/3.8-flash` refuse free traffic; flash-lite models have separate, larger quotas, hence the default chain `gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite`. When only the embedding quota is exhausted, questions about the user's own data are still answered from the data tools.
20. **A failed retrieval is an error, not "not in my sources".** With embedding as a network call, treating a failure as "nothing found" would give a wrong, confident-sounding refusal; it now answers 503 (429 on quota).

Found while mapping and fixed: `GET /api/TTN/device_data/:dev_id/:page` (IOT)
never rejected foreign devices (`find()` returns `[]`, not an error), and
Backend `PUT/DELETE /api/activities/:id` didn't check the owner.

## 10. Out of scope (unchanged)
Reranker/LLM judge, hybrid full-text search, trusted-web fallback, registry
lookup for registered products, live PSSS bulletins — each when the query log
shows the need.
