import { proxyDepreciationScope } from "@/src/lib/depreciationProxy";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { clientId } = await context.params;
  return proxyDepreciationScope(req, "client", clientId);
}
