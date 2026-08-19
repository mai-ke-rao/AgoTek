# AgoTek Automation — Architecture Spec (v2)

> Build doc for Claude Code — the stable **target description**. Progress and
> sequencing live in a separate personal checklist, not here.
>
> Adds a **trigger/action rules engine** to AgoTek as a new `automation/` **module
> inside the existing IOT service**. `Backend/` is untouched.
>
> **Stack:** TypeScript · PostgreSQL · Drizzle ORM · Zod · Playwright.
> **No LLM.** Rules are authored through a form; the grammar (flat AND/OR over
> comparisons) is fully form-expressible, so natural-language authoring would have
> been decoration. Deliberate, defensible call — see §1.

One line: a user defines an automation ("send a downlink to the valve when soil
moisture < 20 AND light < 300"), stored as a **normalized relational rule** in
Postgres, and a deterministic evaluator fires device downlinks when incoming
telemetry satisfies it.

---

## 1. Scope & non-goals

Design principle: **the interesting engineering is the data model and the
evaluator, not the UI.** The action side stays dumb because a bug there actuates
real hardware.

### In scope (v1)
- **Polyglot persistence:** Postgres for the relational rules domain; MongoDB
  retained for `Bucket` time-series telemetry.
- **Condition:** a flat list of clauses joined by a **single** `AND` or `OR`.
- **Clause:** `variable <comparator> threshold` on the variable's latest value.
- Cross-variable, cross-device conditions.
- **Firing:** fire on **every** evaluation where the condition is true (no
  edge-trigger, no cooldown, no latch).
- **Idempotency:** don't fire twice for the same redelivered uplink (TTN `f_cnt`).
- **Action:** exactly one type — **send a downlink** to one of the user's devices,
  reusing the existing `send-downlink` logic.
- Three test layers: evaluator (deterministic), DB integration (real Postgres),
  API (Playwright).

### Explicit non-goals — name these in the README as deliberate cuts
- ❌ **LLM / natural-language rule authoring** — the v1 grammar is form-expressible;
  an LLM would add non-determinism and failure modes for no user benefit. Worth
  reconsidering only if the grammar grew to time windows and nested booleans,
  where forms genuinely break down.
- ❌ Edge-triggering, cooldown, Tago-style lock/unlock latch, hysteresis/deadband.
- ❌ Time windows (`within(1h)`), aggregations (`avg`/`min`/`count`).
- ❌ Nested boolean groups `(A AND B) OR C` — flat only.
- ❌ Webhook-to-arbitrary-URL action (no user-typed URL exists → no SSRF surface).
- ❌ Migrating existing Mongo collections (users/devices/parcels) to Postgres.
- ❌ Automation as a separate deployable service — merged; split later on evidence.

---

## 2. Architecture

```
┌───────────┐        ┌───────────────────────────────────────┐
│ Backend/  │        │  Long-lived service (was IOT/)         │
│ auth,     │        │  ┌────────────┐   ┌─────────────────┐  │
│ parcels   │        │  │ ingestion/ │──▶│  automation/    │  │
│ (Render)  │        │  │ TTN hook,  │   │  evaluator,     │  │
│           │        │  │ Socket.IO, │◀──│  rules CRUD     │  │
└─────┬─────┘        │  │ downlink   │   │  (Drizzle)      │  │
      │              │  └─────┬──────┘   └────────┬────────┘  │
      │              │  shared: models/ utils/(crypto, mw)    │
      │              └────────┼───────────────────┼───────────┘
      └──────────────┬────────┘                   │
              ┌──────▼───────┐          ┌─────────▼─────────┐
              │ MongoDB Atlas│          │    PostgreSQL     │
              │ users,devices│          │ rules, clauses,   │
              │ parcels,     │          │ actions, audit,   │
              │ Bucket (TS)  │          │ cursors           │
              └──────────────┘          └───────────────────┘
```

**One process, two modules.** `ingestion/` (TTN webhook + Socket.IO + downlink)
and `automation/` (new) share top-level `models/` and `utils/` — single source of
truth, no duplicated crypto. Isolation between them comes from **error
boundaries** (§6.3), not separate processes.

**Trigger path:** after `Bucket.insertMany`, ingestion calls
`automation.onReadings(devId, readings, fCnt)` — **fire-and-forget, wrapped in
try/catch**, so it never blocks or endangers the fast TTN `200` ack.

**Language:** the service runs as TypeScript with `allowJs: true`. Existing `.js`
stays untouched; all new `automation/` code is `.ts`. Adds a `tsx`/`tsc` step.

### 2.1 Why two databases (the story, stated honestly)
- **Mongo keeps telemetry.** `Bucket` is a high-volume append-only time series —
  no joins, written on every uplink. Mongo fits, and it already works.
- **Postgres takes the rules domain.** rules → clauses → actions → audit is a
  classic 1:many relational graph with referential integrity, cascade deletes and
  constrained enums. Modelling it as embedded Mongo documents throws away exactly
  the guarantees that make it correct.
- **The soft edge, named up front:** `user_id` and `dev_id` live in Mongo, so
  Postgres stores them as plain columns with **no FK** — a cross-boundary
  reference validated at the application layer (§6.1). This is the honest cost of
  polyglot persistence, and it's the same problem any cross-service reference has.

---

## 3. Data model

### 3.1 Postgres schema (Drizzle, `automation/db/schema.ts`)

```ts
import { pgTable, serial, bigserial, text, boolean, doublePrecision,
         integer, timestamp, jsonb, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";

export const combinatorEnum = pgEnum("combinator", ["AND", "OR"]);
export const comparatorEnum = pgEnum("comparator", ["lt","lte","gt","gte","eq","neq"]);
export const actionTypeEnum = pgEnum("action_type", ["downlink"]);
export const fireStatusEnum = pgEnum("fire_status", ["ok", "failed"]);

export const rules = pgTable("rules", {
  id:         serial("id").primaryKey(),
  userId:     text("user_id").notNull(),        // Mongo ObjectId — cross-boundary ref
  name:       text("name").notNull(),
  combinator: combinatorEnum("combinator").notNull(),
  enabled:    boolean("enabled").notNull().default(false),   // OFF by default (§6.2)
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byUser: index("rules_user_idx").on(t.userId) }));

export const ruleClauses = pgTable("rule_clauses", {
  id:         serial("id").primaryKey(),
  ruleId:     integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  devId:      text("dev_id").notNull(),
  variable:   text("variable").notNull(),
  comparator: comparatorEnum("comparator").notNull(),
  threshold:  doublePrecision("threshold").notNull(),
  position:   integer("position").notNull(),
}, (t) => ({
  // HOT PATH: "which rules care about this device+variable?"
  byDevVar: index("clauses_dev_var_idx").on(t.devId, t.variable),
  ordering: uniqueIndex("clauses_rule_pos_idx").on(t.ruleId, t.position),
}));

export const ruleActions = pgTable("rule_actions", {
  id:          serial("id").primaryKey(),
  ruleId:      integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  type:        actionTypeEnum("type").notNull(),
  targetDevId: text("target_dev_id").notNull(),
  payload:     jsonb("payload").notNull(),      // TTN downlink body — genuinely schemaless
}, (t) => ({ onePerRule: uniqueIndex("actions_rule_idx").on(t.ruleId) }));  // v1: 1 action/rule

export const ruleState = pgTable("rule_state", {
  ruleId:      integer("rule_id").primaryKey().references(() => rules.id, { onDelete: "cascade" }),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),  // audit + cooldown seam
});

export const deviceCursor = pgTable("device_cursor", {             // idempotency (§5)
  devId:    text("dev_id").primaryKey(),
  lastFCnt: integer("last_f_cnt").notNull(),
});

export const ruleAudit = pgTable("rule_audit", {
  id:          bigserial("id", { mode: "number" }).primaryKey(),
  ruleId:      integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  userId:      text("user_id").notNull(),
  firedAt:     timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
  snapshot:    jsonb("snapshot").notNull(),     // the values that caused the fire
  actionType:  actionTypeEnum("action_type").notNull(),
  targetDevId: text("target_dev_id").notNull(),
  status:      fireStatusEnum("status").notNull(),
  detail:      text("detail"),
}, (t) => ({ byRule: index("audit_rule_time_idx").on(t.ruleId, t.firedAt) }));
```

**Modelling notes worth defending in an interview:**
- Clauses are **rows, not a JSON blob** — that's the whole point of using Postgres.
  You can index them, join on them, and let the DB enforce shape.
- `jsonb` appears exactly **twice**, only where the data is genuinely schemaless
  (a TTN downlink payload, an audit snapshot). Knowing where *not* to reach for
  jsonb is the signal.
- `ON DELETE CASCADE` means deleting a rule cleans up clauses, action, state and
  audit atomically — no orphan rows, no application-side cleanup code.
- Enums are DB-level, so an invalid comparator can't be persisted even by a bug.

### 3.2 Zod via `drizzle-zod` — one source of truth
Generate insert/select schemas from the tables (`createInsertSchema`), extend with
API-level rules (clause count 1–5, non-empty name). No hand-maintained duplicate
schema; the table definition *is* the contract.

### 3.3 Mongo index (unchanged store, new hot query)
`Bucket: { dev_id: 1, name: 1, date_time: -1 }` — latest-value lookups.

---

## 4. Condition semantics
- **Latest value only** — for each clause `(devId, variable)`, read the newest
  `Bucket` doc by `date_time`. No history, no aggregation, no time window.
- **Missing variable** (never reported): clause is **false**. Never throw.
- **Combinator:** condition truth = `AND`/`OR` over clause truths.

---

## 5. Firing model — fire on every match

```
onReadings(devId, readings, fCnt):
  if fCnt <= deviceCursor[devId]:  return          # idempotency — already seen
  upsert deviceCursor[devId] = fCnt

  candidates = SELECT DISTINCT r.* FROM rules r
               JOIN rule_clauses c ON c.rule_id = r.id
               WHERE c.dev_id = :devId AND r.enabled = true      # uses clauses_dev_var_idx

  for rule in candidates:                          # each in its own try/catch (§6.3)
      load clauses + action (single joined query)
      if evaluate(condition) == true:
          fireAction(action)                       # → sendDownlink(...)
          insert ruleAudit row; update ruleState.lastFiredAt
```

**Idempotency is the one firing guard that stays.** TTN can redeliver a webhook →
duplicate insert → `onReadings` called again with the same `f_cnt`. The cursor
skips it. A genuine re-cross (new `f_cnt`, condition true again) still fires —
that's intended behaviour, not a bug.

**Transactions:** rule creation (rule + clauses + action) happens in a single
Drizzle transaction. A half-written rule must never exist.

> **Deferred growth path (know it, don't build it):** edge-triggering = a
> `lastConditionTrue` flag, fire only on false→true. Cooldown = gate re-fires on
> `ruleState.lastFiredAt`. Latch = a `LATCHED` state cleared by an explicit
> unlock. All slot into this loop without restructuring it.

---

## 6. Security & safety

### 6.1 Ownership re-validation (the cross-boundary reference)
Postgres cannot FK-enforce that a `dev_id` belongs to a `user_id` — those live in
Mongo. The application enforces it: **on create/update and again before firing**,
verify every `dev_id` in the clauses *and* the action target belongs to
`request.user`. Reject otherwise. Name this in the README as the known cost of the
polyglot split.

### 6.2 Actuation safety (this opens real hardware)
- Rules are **`enabled: false` by default** — nothing fires until the user opts in.
- **Audit log** every fired action, success or failure.
- **Kill switch** endpoint: disable all of a user's rules (optionally per device).
- Downlink reuses the existing encrypted-key path (`cryptoHelper` +
  `DEVICE_ENC_KEY`), already in this service — no key duplicated across services
  (a payoff of merging).

### 6.3 Error boundaries (where "blast radius" is actually contained)
One process means an uncaught throw kills ingestion *and* automation. Modules
don't prevent that — **error handling does**:
- Wrap the whole `onReadings` body in try/catch (automation must never break the
  webhook `200`).
- Wrap **each rule's** evaluation individually — one malformed rule logs and is
  skipped; the rest still run.
- Process-level `uncaughtException` / `unhandledRejection` handlers that log
  instead of letting the default terminate fire; host restarts on anything that
  still escapes.

### 6.4 Idempotency — see §5 (`f_cnt` cursor).

---

## 7. Testing — three layers

### 7.1 Evaluator tests — deterministic, exact, no DB
Pure function: `evaluate(condition, latestValues) → boolean`. Instant.

| Case | Setup | Assert |
2
| Compound AND | one clause true, other false | false |
| Compound AND | both true | true |
| Compound OR | either true | true |
| Missing variable | clause var absent from map | false, no throw |
| All comparators | lt/lte/gt/gte/eq/neq at boundary values | exact truth table |

### 7.2 Database integration tests — real Postgres (Docker / Testcontainers)
The new differentiator: this layer tests the **schema**, not just the code.

| Case | Assert |
|---|---|
| Migrations apply to an empty DB | schema matches |
| Cascade delete | deleting a rule removes clauses, action, state, audit |
| Enum constraint | invalid comparator rejected **by the DB** |
| Transaction rollback | a failed clause insert leaves **no** orphan rule |
| Hot-path query | `dev_id` lookup returns only matching enabled rules |
| Idempotency cursor | replaying the same `f_cnt` fires once |
| Error isolation | one malformed rule skipped; others still evaluate |

### 7.3 API tests — Playwright
401 without JWT · 403 on another user's rule or device · Zod validation rejects
malformed payloads · full CRUD lifecycle · enable/disable · kill switch · audit
retrieval.

Interview framing: **unit tests for the logic, integration tests for the schema,
E2E for the contract.** The evaluator is wired to real hardware, so it's the layer
that has to be exhaustively covered — and being deterministic, it *can* be.

---

## 8. API (JWT-protected, shared `SECRET`, scoped to `request.user`)
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/rules` | Create rule (rule + clauses + action, one transaction) |
| `GET` | `/api/rules` | List user's rules (joined with clauses + action) |
| `GET` | `/api/rules/:id` | Single rule + state |
| `PATCH` | `/api/rules/:id` | Enable/disable/edit |
| `DELETE`| `/api/rules/:id` | Remove (cascades) |
| `POST` | `/api/rules/kill-switch` | Disable all rules (optionally per device) |
| `GET` | `/api/rules/:id/audit` | Fired-action history (paginated, indexed) |

**Downlink executor:** extract the core of the existing `send-downlink` route into
a reusable `sendDownlink(userId, devId, payload)` function; the HTTP route and the
automation executor both call it. Single source of truth for device lookup + key
decrypt + TTN POST.

---

## 9. Environment & deployment
```
MONGODB_URI        # Atlas — telemetry, users, devices
DATABASE_URL       # Postgres — rules domain (Neon / Supabase / Render free tier)
SECRET             # shared JWT
PORT=3002
DEVICE_ENC_KEY     # cryptoHelper — used by the downlink executor
```
Frontend: existing `VITE_IOT_URL` already points here — add a rules UI (list /
form-based create / enable-disable / audit view).

**Hosting (open decision — see checklist).** This service holds Socket.IO
connections and receives webhooks, so it **cannot scale-to-zero** without dropping
live data. `Backend/` (stateless) is fine on Render free. The long-lived service
wants an always-on host (e.g. Fly.io `min_machines_running = 1`). If staying
all-Render for now, document the cold-start caveat honestly in the README.

---

## 10. Build order (target per phase — sequencing lives in the checklist)
1. Deploy the existing Backend/IOT split (blocking: the live link still serves the
   pre-split monolith; the CV's microservices claim isn't true until it's up).
2. TS setup (`allowJs`), Postgres + Drizzle wired, schema + first migration,
   `drizzle-zod` schemas. Verify migrations run against a clean DB.
3. Rules CRUD API (transactional create, ownership checks) + Playwright API tests.
4. Evaluator + `onReadings` wiring + `f_cnt` cursor + error boundaries.
   Write §7.1 and §7.2 tests alongside — this is the core.
5. Action: extract `sendDownlink`, executor, audit log, kill switch.
6. Frontend rules UI; resolve hosting; deploy.

---

## 11. README skeleton (recruiter reads for 30 seconds)
```
# AgoTek — Automation Rules Engine
> Define IoT automations as relational rules; a deterministic evaluator fires
> device downlinks when live telemetry satisfies them.
[ Live demo ]  [ 20-sec GIF: build a rule → enable → uplink fires a downlink ]

## Data mo
Polyglot persistence: PostgreSQL (Drizzle) for the normalized rules domain —
rules → clauses → actions → audit, with FKs, cascade deletes, DB-level enums and
a composite index on the hot lookup. MongoDB retained for time-series telemetry.
Why: different data shapes, different guarantees.

## How it's tested
Three layers — deterministic evaluator unit tests, database integration tests
against real Postgres (migrations, cascades, constraints, transaction rollback),
and Playwright API tests for auth, ownership and validation.

## Safety
Disabled-by-default rules, full audit e og, kill switch, idempotent on webhook
redelivery, per-rule error isolation, application-level ownership checks across
the Mongo/Postgres boundary.

## Run locally
3 commands (docker compose up for Postgres, migrate, dev).

## Deliberately out of scope (v1)
LLM rule authoring, edge-triggering, cooldown, latch, time windows, aggregations,
nested booleans — one line of reasoning each.
```
