import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "../src/lib/db";

async function main() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
