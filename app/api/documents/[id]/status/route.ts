import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type StatusResponse = {
  id: string;
  processing_status: string;
};

/**
 * Marks an uploaded document as awaiting extraction.
 *
 * The client's "Submit to accountant" option uploads without running Bedrock —
 * extraction is deferred until the accountant opens the transaction to review.
 * This flags the document as `uploaded` so that deferral is distinguishable
 * from a presigned row whose upload never completed.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const payload = await coreApiRequest<StatusResponse>(
      `/api/documents/${encodeURIComponent(id)}/status`,
      { method: "POST", token, body },
    );
    return NextResponse.json(payload);
  } catch (error) {
    return renderUpstreamError(
      `POST /api/documents/${id}/status`,
      error,
      body,
    );
  }
}
