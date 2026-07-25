# AgoTek Build Checklist — personal tracker

> **Yours, not Claude Code's.** Keep it out of the repo (or in a `/notes` folder
> you don't feed to Claude Code). `AUTOMATION_SPEC.md` is the stable target Claude
> Code reads; this is where you track progress and park open questions. If the two
> disagree, fix the spec *first*, then continue.

---

## Decisions LOCKED — do not relitigate
- [x] **Stack: TypeScript + PostgreSQL + Drizzle + Zod + Playwright.** No LLM.
- [x] Sequelize rejected (weak TS). Prisma considered; Drizzle chosen for
      `drizzle-zod` and SQL-first syntax.
- [x] **Postgres for the rules domain, Mongo stays for telemetry** (polyglot).
      No migration of existing users/devices/parcels.
- [x] Automation = a **module inside the existing IOT service**, not a new service.
- [x] Trigger **fires on every match**. Edge-trigger/cooldown/latch understood and
      deliberately deferred. `f_cnt` idempotency is the one guard that stays.
- [x] Action = **device downlink** via an extracted `sendDownlink(...)`. No webhook
      URL → no SSRF surface.
- [x] Automation triggered by a **direct in-process call** after Bucket insert.
- [x] Second project (later): **MS SQL Server telemetry warehouse + ETL**, raw
      T-SQL — stored procs, window functions, star schema, indexing.

> Three re-scopes already happened and each was correct. The stack is now locked.
> Further architecture changes are procrastination in a lab coat. Build.

## Open decisions (resolve at the phase that needs them, not before)
- [ ] **Postgres host** (Phase 2): Neon · Supabase · Render Postgres — all free tier.
- [ ] **Hosting** (Phase 6): Backend on Render + long-lived service on Fly
      always-on · OR all-Render with a documented cold-start caveat.
- [ ] Confirm **TS-with-`allowJs`** (vs. keeping it all JS and dropping the TS angle).

---

## Build sequence

### Phase 0 — deploy the existing split  ⬅ FIRST
- [ ] Create `IOT/.env`, `npm install` in `IOT/`.
- [ ] Deploy post-split Backend + IOT so the live link serves the split app.
- **Done when:** agotek.onrender.com is the split version → the CV
  "microservices" line becomes true.

### Phase 1 — TypeScript setup
- [ ] `tsconfig.json` with `allowJs`, `tsx`/`tsc` dev+build scripts.
- **Done when:** the service still runs unchanged, with a `.ts` file in the build.

### Phase 2 — Postgres + Drizzle + schema
- [ ] Provision Postgres (free tier) + `docker-compose.yml` for local.
- [ ] `automation/db/schema.ts` per spec §3.1; generate + run first migration.
- [ ] `drizzle-zod` schemas; verify migrations apply to a clean DB.
- **Done when:** `drizzle-kit migrate` builds the schema from empty, twice, cleanly.

### Phase 3 — rules CRUD API
- [ ] Transactional create (rule + clauses + action), list/get/patch/delete.
- [ ] Ownership checks against Mongo devices (spec §6.1).
- [ ] Playwright API tests: 401, 403, validation, full lifecycle.
- **Done when:** you can build and delete a rule via API and cascades verify clean.

### Phase 4 — evaluator + DB integration tests  ⬅ the core
- [ ] `evaluate(condition, latestValues)` pure function + §7.1 unit tests.
- [ ] Latest-value lookup from Mongo; Bucket compound index added.
- [ ] `onReadings` wired from ingestion (fire-and-forget + try/catch).
- [ ] `f_cnt` cursor; per-rule try/catch; process-level handlers.
- [ ] §7.2 integration tests against real Postgres (cascade, enum, rollback,
      hot-path query, idempotency, error isolation).
- **Done when:** all three test layers green and a real uplink fires a stub action.

### Phase 5 — action + safety
- [ ] Extract `sendDownlink(userId, devId, payload)`; route + executor both use it.
- [ ] Audit log, kill switch, disabled-by-default enforced.
- **Done when:** an enabled rule fires a real downlink and it's logged; disabled never fires.

### Phase 6 — UI, deploy, README
- [ ] Frontend rules UI (list / form create / enable-disable / audit).
- [ ] Resolve hosting; deploy.
- [ ] README per spec §11 — demo GIF at top, data-model section, three-layer
      testing section, the "out of scope" list with one-line reasons.
- **Done when:** a stranger can open the live link and build + fire a rule.

### Later — project #2 (start applying with it "in progress")
- [ ] MS SQL Server in Docker (`mcr.microsoft.com/mssql/server`, Developer edition)
      or Azure SQL free tier (bonus: Azure keyword).
- [ ] ETL: Mongo `Bucket` → star schema (`fact_readings` + `dim_device`,
      `dim_variable`, `dim_time`).
- [ ] T-SQL: aggregations, window functions (rolling averages), stored procedures,
      index tuning + execution plans.

---

## Parking lot — deferred on purpose (mention in interviews, don't build)
LLM rule authoring · edge-triggering · cooldown · Tago-style latch ·
hysteresis/deadband · time windows · aggregations · nested booleans · webhook
action + SSRF · splitting automation into its own service · multi-step actions ·
migrating users/devices/parcels to Postgres.

---

## CV alignment list (knock it out in one sitting)
- [ ] Dev CV: Vienna → **Novi Sad**.
- [ ] Tester CV: fix location + add the EU-citizenship line (align both CVs).
- [ ] Add the **microservices** bullet (true after Phase 0).
- [ ] Add **C++** tag + chess-engine bullet (CV currently contradicts the Wärtsilä letter).
- [ ] Add **TypeScript** as real once Phase 1–2 land.
- [ ] Add **PostgreSQL / Drizzle / SQL** once Phase 2–4 land.
- [ ] Custom LinkedIn URL, then make the printed CV URL match.
- [ ] Push the C++ chess repo to GitHub (make the claim clickable).

---

## The rule that actually protects the job search
This project raises **conversion once seen**; it does nothing for **volume**.
Keep Easy Apply + referral outreach running **daily** while you build. A decent
project you're applying with in week 4 beats a perfect one you finish in week 8.
