import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./automation/db/schema.ts",
  out: "./automation/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Backend's assistant keeps documents/chunks/rag_query_log/
  // assistant_rule_proposals in the same database with its own migrations.
  // Scope drizzle-kit to the automation tables so push/pull never touch them.
  tablesFilter: ["rules", "rule_*", "device_cursor"],
});
