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
        const appAccessKeyId = process.env.APP_ACCESS_KEY_ID;
        const appSecretAccessKey = process.env.APP_SECRET_ACCESS_KEY;
        const signer = new Signer({
          hostname: databaseHost!,
          port: Number(process.env.DATABASE_PORT),
          username: databaseUser!,
          region: process.env.APP_REGION || process.env.AWS_REGION,
          ...(appAccessKeyId && appSecretAccessKey
            ? {
                credentials: {
                  accessKeyId: appAccessKeyId,
                  secretAccessKey: appSecretAccessKey,
                },
              }
            : {}),
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
