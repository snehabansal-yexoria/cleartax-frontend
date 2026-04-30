import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import {
  getCoreApiBearerFromRequest,
} from "../../../../../src/lib/coreApi";
import {
  getCognitoInviteStatusByEmail,
  normalizeInviteStatus,
} from "../../../../../src/lib/cognitoInviteStatus";
import {
  assignApiClientsToAccountant,
  findApiDirectoryUserByIdentity,
  listApiDirectoryUsers,
} from "../../../../../src/lib/coreUserDirectory";
import { getDemoClientRecord } from "../../../../../src/lib/demoAccountantData";

export async function GET(req: Request) {
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

    if (!requester) {
      const tokenRole = String(
        decoded["custom:role"] || decoded.role || "",
      ).toUpperCase();

      if (tokenRole === "ACCOUNTANT") {
        return NextResponse.json({
          clients: [
            {
              ...getDemoClientRecord({
                id: String(decoded.sub || "demo-accountant"),
                email: String(decoded.email || ""),
                name: String(decoded.name || decoded.email || "Demo Accountant"),
              }),
              isDemo: true,
            },
          ],
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

    const scope = new URL(req.url).searchParams.get("scope") === "mine"
      ? "mine"
      : "all";

    const demoClient =
      requesterRole === "ACCOUNTANT"
        ? { ...getDemoClientRecord(requester), isDemo: true }
        : null;

    if (!requester.orgId) {
      return NextResponse.json({
        clients: demoClient ? [demoClient] : [],
      });
    }

    const users = await listApiDirectoryUsers(apiToken, {
      orgId: requester.orgId,
    });
    const clients = users.filter(
      (user) =>
        user.role === "client" &&
        user.orgId === requester.orgId &&
        (scope !== "mine" || user.assignedAccountantId === requester.id),
    );
    const cognitoStatuses = new Map(
      await Promise.all(
        clients.map(async (user) => [
          user.email,
          await getCognitoInviteStatusByEmail(user.email),
        ] as const),
      ),
    );

    const clientRecords = clients.map((user) => ({
      id: user.id,
      email: user.email,
      status: normalizeInviteStatus(
        user.status,
        cognitoStatuses.get(user.email) || "",
      ),
      name: user.fullName,
      phoneNumber: user.phoneNumber || "",
      invitedByEmail: user.invitedByEmail || "",
      joinedAt: user.createdAt,
      assignedAccountantId: user.assignedAccountantId || "",
      assignedAccountantName: user.assignedAccountantName || "",
      isDemo: false,
    }));

    if (
      demoClient &&
      !clientRecords.some(
        (client) =>
          client.id === demoClient.id || client.email === demoClient.email,
      )
    ) {
      clientRecords.push(demoClient);
    }

    return NextResponse.json({
      clients: clientRecords,
    });
  } catch (error) {
    console.error("Fetch clients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
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

    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requesterRole = String(requester.role || "").toUpperCase();

    if (requesterRole !== "ACCOUNTANT") {
      return NextResponse.json(
        { error: "Only accountants can move clients to My Clients" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json(
        { error: "Accountant organization is missing" },
        { status: 400 },
      );
    }

    const body = (await req.json()) as { clientIds?: unknown };
    const clientIds = Array.isArray(body.clientIds)
      ? body.clientIds
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
      : [];

    if (clientIds.length === 0) {
      return NextResponse.json(
        { error: "At least one client id is required" },
        { status: 400 },
      );
    }

    const orgUsers = await listApiDirectoryUsers(apiToken, {
      orgId: requester.orgId,
    });

    const validClientIds = new Set(
      orgUsers.filter((user) => user.role === "client").map((user) => user.id),
    );

    const filteredClientIds = clientIds.filter((id) => validClientIds.has(id));

    if (filteredClientIds.length === 0) {
      return NextResponse.json(
        { error: "No valid clients were selected" },
        { status: 400 },
      );
    }

    const assignments = await assignApiClientsToAccountant({
      token: apiToken,
      clientIds: filteredClientIds,
      accountantId: requester.id,
      accountantName: requester.fullName,
    });

    return NextResponse.json({
      success: true,
      assigned_accountant_id: requester.id,
      assigned_count: assignments.length,
      client_ids: assignments.map((assignment) => assignment.id),
    });
  } catch (error) {
    console.error("Assign clients error:", error);
    return NextResponse.json(
      { error: "Failed to assign clients" },
      { status: 500 },
    );
  }
}
