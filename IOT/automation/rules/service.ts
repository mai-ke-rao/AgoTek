import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { rules, ruleClauses, ruleActions, ruleState, ruleAudit } from "../db/schema.js";
import type { CreateRuleRequest, PatchRuleRequest } from "../db/zod.js";

// Data access only — no Express types in here, so the evaluator (step 4) can
// call the same functions the HTTP layer does.
//**** */
// Every query filters on userId, so a route that forgets an ownership check
// still can't reach another user's rows.

const AUDIT_PAGE_SIZE = 15; // matches the device_data pagination in controllers/TTN.js

export type RuleWithRelations = {
  rule: typeof rules.$inferSelect;
  clauses: (typeof ruleClauses.$inferSelect)[];
  action: typeof ruleActions.$inferSelect | null;
  state?: typeof ruleState.$inferSelect | null;
};

// One transaction for rule + clauses + action + state (§5). A half-written rule
// must never exist — a rule with no action would be a trigger that fires nothing.
export async function createRule(
  userId: string,
  input: CreateRuleRequest
): Promise<RuleWithRelations> {
  return db.transaction(async (tx) => {
    const [rule] = await tx
      .insert(rules)
      .values({
        userId,
        name: input.name,
        combinator: input.combinator,
        enabled: input.enabled ?? false, // OFF by default (§6.2)
      })
      .returning();

    const clauses = await tx
      .insert(ruleClauses)
      .values(
        input.clauses.map((clause, i) => ({
          ruleId: rule.id,
          devId: clause.devId,
          variable: clause.variable,
          comparator: clause.comparator,
          threshold: clause.threshold,
          position: i, // caller order is the stored order
        }))
      )
      .returning();

    const [action] = await tx
      .insert(ruleActions)
      .values({
        ruleId: rule.id,
        type: input.action.type,
        targetDevId: input.action.targetDevId,
        payload: input.action.payload,
      })
      .returning();

    // Seeded here so GET /:id always has a state row to return.
    const [state] = await tx.insert(ruleState).values({ ruleId: rule.id }).returning();

    return { rule, clauses, action, state };
  });
}

export async function listRules(userId: string): Promise<RuleWithRelations[]> {
  const owned = await db
    .select()
    .from(rules)
    .where(eq(rules.userId, userId)) // uses rules_user_idx
    .orderBy(desc(rules.createdAt));

  if (owned.length === 0) return [];

  const ruleIds = owned.map((r) => r.id);

  const [clauses, actions] = await Promise.all([
    db
      .select()
      .from(ruleClauses)
      .where(inArray(ruleClauses.ruleId, ruleIds))
      .orderBy(ruleClauses.ruleId, ruleClauses.position),
    db.select().from(ruleActions).where(inArray(ruleActions.ruleId, ruleIds)),
  ]);

  // Group the two flat result sets back onto their rules in one pass each,
  // rather than issuing a query per rule.
  const clausesByRule = new Map<number, (typeof ruleClauses.$inferSelect)[]>();
  for (const clause of clauses) {
    const bucket = clausesByRule.get(clause.ruleId);
    if (bucket) bucket.push(clause);
    else clausesByRule.set(clause.ruleId, [clause]);
  }

  const actionByRule = new Map(actions.map((a) => [a.ruleId, a]));

  return owned.map((rule) => ({
    rule,
    clauses: clausesByRule.get(rule.id) ?? [],
    action: actionByRule.get(rule.id) ?? null,
  }));
}

// Returns null when the rule doesn't exist OR belongs to someone else — the
// route decides which status that becomes.
export async function getRule(userId: string, id: number): Promise<RuleWithRelations | null> {
  const [rule] = await db
    .select()
    .from(rules)
    .where(and(eq(rules.id, id), eq(rules.userId, userId)));

  if (!rule) return null;

  const [clauses, [action], [state]] = await Promise.all([
    db
      .select()
      .from(ruleClauses)
      .where(eq(ruleClauses.ruleId, id))
      .orderBy(ruleClauses.position),
    db.select().from(ruleActions).where(eq(ruleActions.ruleId, id)),
    db.select().from(ruleState).where(eq(ruleState.ruleId, id)),
  ]);

  return { rule, clauses, action: action ?? null, state: state ?? null };
}

// Metadata only — clauses and the action are immutable in v1.
export async function patchRule(
  userId: string,
  id: number,
  patch: PatchRuleRequest
): Promise<typeof rules.$inferSelect | null> {
  const [updated] = await db
    .update(rules)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(rules.id, id), eq(rules.userId, userId)))
    .returning();

  return updated ?? null;
}

// Clauses, action, state and audit go with it via ON DELETE CASCADE — no
// application-side cleanup.
export async function deleteRule(userId: string, id: number): Promise<boolean> {
  const deleted = await db
    .delete(rules)
    .where(and(eq(rules.id, id), eq(rules.userId, userId)))
    .returning({ id: rules.id });

  return deleted.length > 0;
}

// §6.2 — disable everything, or just what touches one device. Returns how many
// rules were actually flipped so the caller can report it.
export async function killSwitch(userId: string, devId?: string): Promise<number> {
  const ownedAndEnabled = and(eq(rules.userId, userId), eq(rules.enabled, true));

  const scope = devId
    ? and(
        ownedAndEnabled,
        // A device is "touched" if it feeds a clause or receives the downlink.
        or(
          sql`EXISTS (SELECT 1 FROM ${ruleClauses} WHERE ${ruleClauses.ruleId} = ${rules.id} AND ${ruleClauses.devId} = ${devId})`,
          sql`EXISTS (SELECT 1 FROM ${ruleActions} WHERE ${ruleActions.ruleId} = ${rules.id} AND ${ruleActions.targetDevId} = ${devId})`
        )
      )
    : ownedAndEnabled;

  const disabled = await db
    .update(rules)
    .set({ enabled: false, updatedAt: new Date() })
    .where(scope)
    .returning({ id: rules.id });

  return disabled.length;
}

// Fired-action history. Stays empty until the executor lands in step 5.
export async function listAudit(
  userId: string,
  ruleId: number,
  page: number
): Promise<(typeof ruleAudit.$inferSelect)[] | null> {
  const [rule] = await db
    .select({ id: rules.id })
    .from(rules)
    .where(and(eq(rules.id, ruleId), eq(rules.userId, userId)));

  if (!rule) return null;

  return db
    .select()
    .from(ruleAudit)
    .where(eq(ruleAudit.ruleId, ruleId))
    .orderBy(desc(ruleAudit.firedAt)) // uses audit_rule_time_idx
    .limit(AUDIT_PAGE_SIZE)
    .offset((page - 1) * AUDIT_PAGE_SIZE);
}
