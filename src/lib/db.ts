import { Pool } from "pg";
import { Signer } from "@aws-sdk/rds-signer";

const databaseHost = process.env.DATABASE_HOST?.trim();
const databaseUser = process.env.DATABASE_USER?.trim();
const databaseName = process.env.DATABASE_NAME?.trim();
const databasePassword = process.env.DATABASE_PASSWORD?.trim();

// One signer for the process. Each new connection still gets a freshly signed
// IAM token (they live 15 minutes), but the signer — and the credential chain
// behind it — is built once instead of on every connect.
let signer: Signer | null = null;
function rdsSigner(): Signer {
  if (!signer) {
    const appAccessKeyId = process.env.APP_ACCESS_KEY_ID;
    const appSecretAccessKey = process.env.APP_SECRET_ACCESS_KEY;
    signer = new Signer({
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
  }
  return signer;
}

export const pool = new Pool({
  host: databaseHost,
  port: Number(process.env.DATABASE_PORT),
  user: databaseUser,
  password: databasePassword ? databasePassword : () => rdsSigner().getAuthToken(),
  database: databaseName,
  ssl: {
    rejectUnauthorized: false,
  },
  // pg's default is to wait for a connection forever. Several routes treat
  // this DB as best-effort (e.g. /api/users/me falls back to the backend's
  // data), and on a host that can't reach it a hung connect held the whole
  // request — and the page waiting on it — until the OS gave up on the socket.
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

// Optional: log pool errors to help debugging
pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});
