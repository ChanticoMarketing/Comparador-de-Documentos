import * as schema from "@shared/schema";
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

let db: ReturnType<typeof import("drizzle-orm").drizzle>;

if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
  // Use local Postgres (pg)
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");

  const pool = new Pool({ connectionString: dbUrl });
  db = drizzle(pool, { schema });

  console.log("✅ Using local Postgres via pg");
} else {
  // Use Neon (WebSocket)
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const ws = (await import("ws")).default;

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: dbUrl });
  db = drizzle({ client: pool, schema });

  console.log("✅ Using Neon via WebSocket");
}

export { db };
