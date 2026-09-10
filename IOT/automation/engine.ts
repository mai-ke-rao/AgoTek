import { and, eq, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { rules, ruleClauses, ruleActions, deviceCursor } from "./db/schema.js";
import Bucket from "../models/bucket.js";
import logger from "../utils/logger.js";
import { evaluate, valueKey, type LatestValues } from "./evaluator.js";
import { assertDevicesOwned } from "./rules/ownership.js";
import { fireRule } from "./executor.js";

// The firing loop (§5). Called by ingestion after Bucket.insertMany, without
// await — nothing in here may delay or endanger the TTN 200 ack (§2, §6.3).

export type Readings = Record<string, unknown>;

type CandidateRule = Pick<typeof rules.$inferSelect, "id" | "userId" | "name" | "combinator">;

export async function onReadings(
  devId: string,
  readings: Readings,
  fCnt?: number
): Promise<void> {
  try {
    if (!(await advanceCursor(devId, fCnt))) {
      logger.info(`automation: ${devId} f_cnt ${fCnt} already seen, skipping`);
      return;
    }

    const candidates = await findCandidateRules(devId);

    // Each rule in its own boundary: one malformed or unowned rule logs and is
    // skipped, the rest still run (§6.3).
    for (const rule of candidates) {
      try {
        await evaluateAndFire(rule, devId, readings, fCnt);
      } catch (err) {
        logger.error(`automation: rule ${rule.id} (${rule.name}) skipped:`, err);
      }
    }
  } catch (err) {
    logger.error(`automation: onReadings failed for ${devId}:`, err);
  }
}

// Idempotency (§5). TTN can redeliver a webhook; the same f_cnt must not fire
// twice. Done as one atomic upsert so two concurrent redeliveries can't both
// win: the conditional update returns a row only for the one that advanced it.
//
// Deliberate deviation from the spec's `fCnt <= cursor`: a device that rejoins
// resets its frame counter to 0, and a strict monotonic guard would then
// silently ignore it until the counter climbed back past the old high mark.
// Refusing only an *equal* f_cnt still dedupes redelivery and survives resets.
async function advanceCursor(devId: string, fCnt?: number): Promise<boolean> {
  if (!Number.isInteger(fCnt)) {
    // Nothing to dedupe on (e.g. a hand-built payload) — evaluate anyway
    // rather than making rules untestable from the TTN console.
    logger.info(`automation: ${devId} uplink has no f_cnt, skipping idempotency guard`);
    return true;
  }

  const advanced = await db
    .insert(deviceCursor)
    .values({ devId, lastFCnt: fCnt as number })
    .onConflictDoUpdate({
      target: deviceCursor.devId,
      set: { lastFCnt: fCnt as number },
      setWhere: sql`${deviceCursor.lastFCnt} <> ${fCnt}`,
    })
    .returning({ devId: deviceCursor.devId });

  return advanced.length > 0;
}

// "Which enabled rules have a clause on this device?" — the hot path the
// clauses_dev_var_idx exists for.
async function findCandidateRules(devId: string): Promise<CandidateRule[]> {
  return db
    .selectDistinct({
      id: rules.id,
      userId: rules.userId,
      name: rules.name,
      combinator: rules.combinator,
    })
    .from(rules)
    .innerJoin(ruleClauses, eq(ruleClauses.ruleId, rules.id))
    .where(and(eq(ruleClauses.devId, devId), eq(rules.enabled, true)));
}

async function evaluateAndFire(
  rule: CandidateRule,
  devId: string,
  readings: Readings,
  fCnt?: number
): Promise<void> {
  const [clauses, [action]] = await Promise.all([
    db.select().from(ruleClauses).where(eq(ruleClauses.ruleId, rule.id)).orderBy(ruleClauses.position),
    db.select().from(ruleActions).where(eq(ruleActions.ruleId, rule.id)),
  ]);

  if (!action) throw new Error("rule has no action");

  // Ownership re-validated before every fire (§6.1): a device can be deleted
  // or change hands after the rule was created, and Postgres can't know.
  await assertDevicesOwned(rule.userId, [...clauses.map((c) => c.devId), action.targetDevId]);

  const latest = await loadLatestValues(clauses, devId, readings);

  if (!evaluate(rule.combinator, clauses, latest)) return;

  const snapshot: Record<string, unknown> = { fCnt: fCnt ?? null };
  for (const clause of clauses) {
    const key = valueKey(clause.devId, clause.variable);
    snapshot[key] = latest.get(key) ?? null;
  }

  const status = await fireRule({ rule, action, snapshot });
  logger.info(`automation: rule ${rule.id} (${rule.name}) fired → ${action.targetDevId}: ${status}`);
}

// Latest value per clause (§4). The triggering uplink's own readings are the
// newest by definition, so they're used directly; every other (device,
// variable) pair is read back from Bucket, newest first (§3.3 index).
async function loadLatestValues(
  clauses: { devId: string; variable: string }[],
  devId: string,
  readings: Readings
): Promise<LatestValues> {
  const latest: LatestValues = new Map();

  const lookups = clauses.map(async (clause) => {
    const key = valueKey(clause.devId, clause.variable);
    if (latest.has(key)) return;

    if (clause.devId === devId && clause.variable in readings) {
      latest.set(key, readings[clause.variable]);
      return;
    }

    const row = await Bucket.findOne({ dev_id: clause.devId, name: clause.variable })
      .sort({ date_time: -1 })
      .lean<{ value: unknown } | null>();

    if (row) latest.set(key, row.value);
  });

  await Promise.all(lookups);
  return latest;
}
