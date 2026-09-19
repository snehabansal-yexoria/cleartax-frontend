import { NextResponse } from "next/server";
import {
  CoreApiError,
  getCoreApiBearerFromRequest,
  getCoreClient,
} from "../../../../../../src/lib/coreApi";

export async function GET(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;
  const id = String(clientId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Client id is required" }, { status: 400 });
  }

  try {
    // Single backend call — the core API resolves the caller, enforces role/org
    // and returns the enriched client (counts, status, assignment flags).
    const c = await getCoreClient(getCoreApiBearerFromRequest(req), id);
    return NextResponse.json({
      client: {
        id: c.id,
        email: c.email,
        status: c.status,
        name: c.fullName,
        phoneNumber: c.phoneNumber,
        invitedByEmail: c.invitedByEmail,
        joinedAt: c.joinedAt,
        assignedAccountantId: c.assignedAccountantId,
        assignedAccountantName: c.assignedAccountantName,
        propertiesCount: c.propertiesCount,
        totalMarketValue: c.totalMarketValue,
        isAssignedToCurrentAccountant: c.isAssignedToCurrentAccountant,
        isAssignedToAnotherAccountant: c.isAssignedToAnotherAccountant,
      },
    });
  } catch (error) {
    console.error("Fetch client detail error:", error);
    const status = error instanceof CoreApiError ? error.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch client details" },
      { status },
    );
  }
}
