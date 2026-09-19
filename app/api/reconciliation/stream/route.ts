import { getBearerToken } from "@/src/lib/coreApiProxy";

const CORE_API_BASE =
  process.env.CORE_API_BASE_URL ?? process.env.NEXT_PUBLIC_CORE_API_BASE_URL ?? "";

// SSE streams must not be buffered — use Edge runtime so Next.js doesn't
// buffer the response body before forwarding it to the browser.
export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // EventSource cannot send custom headers, so the token is passed as ?token=
  // for SSE connections. Fall back to the Authorization header for API clients.
  const token = getBearerToken(req) ?? url.searchParams.get("token");
  if (!token) {
    return new Response(JSON.stringify({ error: "No token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const jobId = url.searchParams.get("job_id");
  if (!jobId) {
    return new Response(JSON.stringify({ error: "job_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(
    `${CORE_API_BASE}/api/reconciliation/stream?job_id=${encodeURIComponent(jobId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
    },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: `Upstream returned ${upstream.status}` }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } },
    );
  }

  // Pipe the upstream SSE body straight to the client.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
