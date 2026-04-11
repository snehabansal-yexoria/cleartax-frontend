import { NextResponse } from "next/server";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const client = new STSClient({ region: process.env.AWS_REGION });
    const result = await client.send(new GetCallerIdentityCommand({}));

    return NextResponse.json({
      ok: true,
      identity: result,
      profile: process.env.AWS_PROFILE ?? null,
      region: process.env.AWS_REGION ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        profile: process.env.AWS_PROFILE ?? null,
        region: process.env.AWS_REGION ?? null,
      },
      { status: 500 },
    );
  }
}
