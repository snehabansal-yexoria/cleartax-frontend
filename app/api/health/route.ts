import { NextResponse } from "next/server";
import { Client } from "pg";
import { Signer } from "@aws-sdk/rds-signer";

export const runtime = "nodejs";

export async function GET() {
  const host = process.env.DATABASE_HOST!;
  const port = Number(process.env.DATABASE_PORT || 5432);
  const user = process.env.DATABASE_USER!;
  const database = process.env.DATABASE_NAME!;
  const region = process.env.AWS_REGION!;

  try {
    const signer = new Signer({
      hostname: host,
      port,
      username: user,
      region,
    });

    const token = await signer.getAuthToken();

    const client = new Client({
      host,
      port,
      user,
      database,
      password: token,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    await client.connect();

    const result = await client.query(
      "SELECT NOW() AS now, current_user AS user, current_database() AS database",
    );

    await client.end();

    return NextResponse.json({
      ok: true,
      message: "Direct database connection successful",
      data: result.rows[0],
      connection: {
        host,
        port,
        user,
        database,
        region,
      },
      tokenDebug: {
        generated: true,
        length: token.length,
      },
    });
  } catch (error) {
    console.error("Direct DB health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Direct database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
        connection: {
          host,
          port,
          user,
          database,
          region,
        },
      },
      { status: 500 },
    );
  }
}
