import { NextResponse } from "next/server";
import { verifyToken } from "../../../../src/lib/verifyToken";
import {
  getCoreApiBearerFromRequest,
  listCoreOrganizations,
} from "../../../../src/lib/coreApi";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];
    await verifyToken(idToken);
    const accessToken = getCoreApiBearerFromRequest(req, idToken);

    return NextResponse.json({
      organizations: await listCoreOrganizations(accessToken),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 },
    );
  }
}
