CREATE TYPE "public"."action_type" AS ENUM('downlink');--> statement-breakpoint
CREATE TYPE "public"."combinator" AS ENUM('AND', 'OR');--> statement-breakpoint
CREATE TYPE "public"."comparator" AS ENUM('lt', 'lte', 'gt', 'gte', 'eq', 'neq');--> statement-breakpoint
CREATE TYPE "public"."fire_status" AS ENUM('ok', 'failed');--> statement-breakpoint
CREATE TABLE "device_cursor" (
	"dev_id" text PRIMARY KEY NOT NULL,
	"last_f_cnt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"type" "action_type" NOT NULL,
	"target_dev_id" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb NOT NULL,
	"action_type" "action_type" NOT NULL,
	"target_dev_id" text NOT NULL,
	"status" "fire_status" NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "rule_clauses" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"dev_id" text NOT NULL,
	"variable" text NOT NULL,
	"comparator" "comparator" NOT NULL,
	"threshold" double precision NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_state" (
	"rule_id" integer PRIMARY KEY NOT NULL,
	"last_fired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"combinator" "combinator" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rule_actions" ADD CONSTRAINT "rule_actions_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_audit" ADD CONSTRAINT "rule_audit_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_clauses" ADD CONSTRAINT "rule_clauses_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_state" ADD CONSTRAINT "rule_state_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "actions_rule_idx" ON "rule_actions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "audit_rule_time_idx" ON "rule_audit" USING btree ("rule_id","fired_at");--> statement-breakpoint
CREATE INDEX "clauses_dev_var_idx" ON "rule_clauses" USING btree ("dev_id","variable");--> statement-breakpoint
CREATE UNIQUE INDEX "clauses_rule_pos_idx" ON "rule_clauses" USING btree ("rule_id","position");--> statement-breakpoint
CREATE INDEX "rules_user_idx" ON "rules" USING btree ("user_id");