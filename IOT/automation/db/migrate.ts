// Applies pending SQL migrations from automation/db/migrations. Run as the
// Fly release_command before each deploy (see fly.toml), or locally with
// `npm run migrate`. Uses the runtime migrator so drizzle-kit (a devDependency)
// is not needed in the production image.
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "automation/db/migrations" });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
