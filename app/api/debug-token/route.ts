import { NextResponse } from "next/server";
import { Signer } from "@aws-sdk/rds-signer";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

export async function GET() {
  try {
    const host = process.env.DATABASE_HOST!;
    const port = Number(process.env.DATABASE_PORT || 5432);
    const user = process.env.DATABASE_USER!;
    const region = process.env.AWS_REGION!;

    const signer = new Signer({
      hostname: host,
      port,
      username: user,
      region,
    });

    const sts = new STSClient({ region });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const token = await signer.getAuthToken();
    const tokenHash = createHash("sha256").update(token).digest("hex");

    return NextResponse.json({
      ok: true,
      identity,
      user,
      host,
      port,
      region,
      tokenLength: token.length,
      tokenHash,
      tokenPreview: `${token.slice(0, 40)}...${token.slice(-20)}`,
      fullToken: token,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
