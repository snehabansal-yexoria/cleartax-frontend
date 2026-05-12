import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type PresignResponse = {
  upload_url: string;
  s3_key: string;
  document_id: string;
};

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const url = new URL(req.url);
  const filename = url.searchParams.get("filename");
  if (!filename) {
    return NextResponse.json(
      { error: "filename query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const payload = await coreApiRequest<PresignResponse>(
      `/api/presign?filename=${encodeURIComponent(filename)}`,
      { token },
    );
    return NextResponse.json(payload);
  } catch (error) {
    return renderUpstreamError("GET /api/documents/presign", error);
  }
}
