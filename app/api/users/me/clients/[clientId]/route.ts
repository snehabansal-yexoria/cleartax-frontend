import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../../src/lib/verifyToken";
import {
  getCoreApiBearerFromRequest,
} from "../../../../../../src/lib/coreApi";
import {
  getCognitoInviteStatusByEmail,
  normalizeInviteStatus,
} from "../../../../../../src/lib/cognitoInviteStatus";
import {
  findApiDirectoryUserByIdentity,
  listApiDirectoryUsers,
} from "../../../../../../src/lib/coreUserDirectory";
import { getDemoClientRecord } from "../../../../../../src/lib/demoAccountantData";

export async function GET(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = await verifyToken(idToken);
    const apiToken = getCoreApiBearerFromRequest(req, idToken);

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const requester = await findApiDirectoryUserByIdentity(apiToken, {
      id: String(decoded.sub || ""),
      email: String(decoded.email || ""),
    });

    const params = await context.params;
    const clientId = String(params.clientId || "").trim();

    if (!clientId) {
      return NextResponse.json({ error: "Client id is required" }, { status: 400 });
    }

    if (!requester) {
      const tokenRole = String(
        decoded["custom:role"] || decoded.role || "",
      ).toUpperCase();
      const demoClient = getDemoClientRecord({
        id: String(decoded.sub || "demo-accountant"),
        email: String(decoded.email || ""),
        name: String(decoded.name || decoded.email || "Demo Accountant"),
      });

      if (tokenRole === "ACCOUNTANT" && clientId === demoClient.id) {
        return NextResponse.json({
          client: {
            ...demoClient,
            isDemo: true,
          },
        });
      }

      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requesterRole = String(requester.role || "").toUpperCase();

    if (!["ADMIN", "ACCOUNTANT"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "You are not allowed to view clients" },
        { status: 403 },
      );
    }

    const demoClient = getDemoClientRecord(requester);

    if (requesterRole === "ACCOUNTANT" && clientId === demoClient.id) {
      return NextResponse.json({
        client: {
          ...demoClient,
          isDemo: true,
        },
      });
    }

    if (!requester.orgId) {
      return NextResponse.json({ error: "Organization missing" }, { status: 400 });
    }

    const users = await listApiDirectoryUsers(apiToken, {
      orgId: requester.orgId,
    });

    const client = users.find(
      (user) => user.id === clientId && user.role === "client",
    );

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({
      client: {
        id: client.id,
        email: client.email,
        status: normalizeInviteStatus(
          client.status,
          await getCognitoInviteStatusByEmail(client.email),
        ),
        name: client.fullName,
        phoneNumber: client.phoneNumber || "",
        invitedByEmail: client.invitedByEmail || "",
        joinedAt: client.createdAt,
        assignedAccountantId: client.assignedAccountantId || "",
        assignedAccountantName: client.assignedAccountantName || "",
      },
    });
  } catch (error) {
    console.error("Fetch client detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch client details" },
      { status: 500 },
    );
  }
}
