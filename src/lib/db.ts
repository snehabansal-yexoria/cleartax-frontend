import { Pool } from "pg";
import { Signer } from "@aws-sdk/rds-signer";

const databaseHost = process.env.DATABASE_HOST?.trim();
const databaseUser = process.env.DATABASE_USER?.trim();
const databaseName = process.env.DATABASE_NAME?.trim();
const databasePassword = process.env.DATABASE_PASSWORD?.trim();

export const pool = new Pool({
  host: databaseHost,
  port: Number(process.env.DATABASE_PORT),
  user: databaseUser,
  password: databasePassword
    ? databasePassword
    : async () => {
        const signer = new Signer({
          hostname: databaseHost!,
          port: Number(process.env.DATABASE_PORT),
          username: databaseUser!,
          region: process.env.AWS_REGION,
        });

        return signer.getAuthToken();
      },
  database: databaseName,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Optional: log pool errors to help debugging
pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});
