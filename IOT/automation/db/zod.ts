import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { rules, ruleClauses, ruleActions } from "./schema.js";

export const insertRuleSchema = createInsertSchema(rules, {
  name: (schema) => schema.min(1, "name must not be empty"),
});
export const selectRuleSchema = createSelectSchema(rules);

export const insertRuleClauseSchema = createInsertSchema(ruleClauses);
export const selectRuleClauseSchema = createSelectSchema(ruleClauses);

export const insertRuleActionSchema = createInsertSchema(ruleActions);
export const selectRuleActionSchema = createSelectSchema(ruleActions);

// POST /api/rules request shape (§3.2, §6.2): rule fields + 1-5 clauses + one action.
export const createRuleRequestSchema = insertRuleSchema
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true })
  .extend({
    clauses: z
      .array(insertRuleClauseSchema.omit({ id: true, ruleId: true, position: true }))
      .min(1, "at least one clause is required")
      .max(5, "at most five clauses are allowed"),
    action: insertRuleActionSchema.omit({ id: true, ruleId: true }),
  });

export type CreateRuleRequest = z.infer<typeof createRuleRequestSchema>;