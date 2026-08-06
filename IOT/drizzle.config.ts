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
});
