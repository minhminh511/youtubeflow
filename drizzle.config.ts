import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Match Next.js's local file precedence without overriding deployment variables.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Configure the PostgreSQL connection in .env, .env.local, or the deployment environment before running Drizzle.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: databaseUrl },
});
