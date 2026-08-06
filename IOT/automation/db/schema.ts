import {
  pgTable, serial, bigserial, text, boolean, doublePrecision,
  integer, timestamp, jsonb, pgEnum, uniqueIndex, index,
} from "drizzle-orm/pg-core";

export const combinatorEnum = pgEnum("combinator", ["AND", "OR"]);
export const comparatorEnum = pgEnum("comparator", ["lt", "lte", "gt", "gte", "eq", "neq"]);
export const actionTypeEnum = pgEnum("action_type", ["downlink"]);
export const fireStatusEnum = pgEnum("fire_status", ["ok", "failed"]);

export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Mongo ObjectId — cross-boundary ref
  name: text("name").notNull(),
  combinator: combinatorEnum("combinator").notNull(),
  enabled: boolean("enabled").notNull().default(false), // OFF by default (§6.2)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("rules_user_idx").on(t.userId)]);

export const ruleClauses = pgTable("rule_clauses", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  devId: text("dev_id").notNull(),
  variable: text("variable").notNull(),
  comparator: comparatorEnum("comparator").notNull(),
  threshold: doublePrecision("threshold").notNull(),
  position: integer("position").notNull(),
}, (t) => [
  // HOT PATH: "which rules care about this device+variable?"
  index("clauses_dev_var_idx").on(t.devId, t.variable),
  uniqueIndex("clauses_rule_pos_idx").on(t.ruleId, t.position),
]);

export const ruleActions = pgTable("rule_actions", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  type: actionTypeEnum("type").notNull(),
  targetDevId: text("target_dev_id").notNull(),
  payload: jsonb("payload").notNull(), // TTN downlink body — genuinely schemaless
}, (t) => [uniqueIndex("actions_rule_idx").on(t.ruleId)]); // v1: 1 action/rule

export const ruleState = pgTable("rule_state", {
  ruleId: integer("rule_id").primaryKey().references(() => rules.id, { onDelete: "cascade" }),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }), // audit + cooldown seam
});

export const deviceCursor = pgTable("device_cursor", { // idempotency (§5)
  devId: text("dev_id").primaryKey(),
  lastFCnt: integer("last_f_cnt").notNull(),
});

export const ruleAudit = pgTable("rule_audit", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ruleId: integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
  snapshot: jsonb("snapshot").notNull(), // the values that caused the fire
  actionType: actionTypeEnum("action_type").notNull(),
  targetDevId: text("target_dev_id").notNull(),
  status: fireStatusEnum("status").notNull(),
  detail: text("detail"),
}, (t) => [index("audit_rule_time_idx").on(t.ruleId, t.firedAt)]);
