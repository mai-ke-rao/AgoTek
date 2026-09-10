import { db } from "./db/client.js";
import { ruleActions, ruleAudit, ruleState, rules } from "./db/schema.js";
import { sendDownlink } from "./downlink.js";

// Action side, kept deliberately dumb (§1): send the downlink, record what
// happened. Every attempt lands in rule_audit whether it succeeded or not
// (§6.2) — a silent failure on hardware is worse than a noisy one.

export type FireStatus = "ok" | "failed";

export interface FireInput {
  rule: Pick<typeof rules.$inferSelect, "id" | "userId">;
  action: typeof ruleActions.$inferSelect;
  snapshot: Record<string, unknown>; // the values that made the condition true
}

export async function fireRule({ rule, action, snapshot }: FireInput): Promise<FireStatus> {
  let status: FireStatus = "ok";
  let detail: string | null = null;

  try {
    await sendDownlink(rule.userId, action.targetDevId, action.payload);
  } catch (err) {
    status = "failed";
    detail = err instanceof Error ? err.message : String(err);
  }

  const firedAt = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(ruleAudit).values({
      ruleId: rule.id,
      userId: rule.userId,
      firedAt,
      snapshot,
      actionType: action.type,
      targetDevId: action.targetDevId,
      status,
      detail,
    });

    // lastFiredAt tracks the last *attempt*, not the last success — a future
    // cooldown (§5, deferred) should also back off from a failing endpoint.
    // Upsert because createRule seeds the row, but a rule that predates that
    // seeding might not have one.
    await tx
      .insert(ruleState)
      .values({ ruleId: rule.id, lastFiredAt: firedAt })
      .onConflictDoUpdate({ target: ruleState.ruleId, set: { lastFiredAt: firedAt } });
  });

  return status;
}
