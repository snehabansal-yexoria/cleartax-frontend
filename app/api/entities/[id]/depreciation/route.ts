import { proxyDepreciationScope } from "@/src/lib/depreciationProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyDepreciationScope(req, "entity", id);
}
