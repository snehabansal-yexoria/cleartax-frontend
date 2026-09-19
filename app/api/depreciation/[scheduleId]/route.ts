import { NextResponse } from "next/server";
import { getCoreDepreciationSchedule } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { parseFyParam } from "@/src/lib/depreciationProxy";

type RouteContext = { params: Promise<{ scheduleId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { scheduleId } = await context.params;
  try {
    const schedule = await getCoreDepreciationSchedule(
      token,
      scheduleId,
      parseFyParam(req.url),
    );
    return NextResponse.json(schedule);
  } catch (error) {
    return renderUpstreamError(`GET /api/depreciation/${scheduleId}`, error);
  }
}
