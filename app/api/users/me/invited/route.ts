import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import {
  getCoreApiBearerFromRequest,
  getCoreRoleId,
  listCoreOrganizations,
} from "../../../../../src/lib/coreApi";
import {
  getCognitoInviteStatusByEmail,
  normalizeInviteStatus,
} from "../../../../../src/lib/cognitoInviteStatus";
import {
  findApiDirectoryUserByIdentity,
  listApiDirectoryUsers,
} from "../../../../../src/lib/coreUserDirectory";

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

    const tokenRole = String(decoded["custom:role"] || "").toUpperCase();
    const requester = await findApiDirectoryUserByIdentity(apiToken, {
      id: String(decoded.sub || ""),
      email: String(decoded.email || ""),
    });

    if (!requester && tokenRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requesterRole =
      tokenRole || String(requester?.role || "").toUpperCase();

    if (!["SUPER_ADMIN", "ADMIN"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "You are not allowed to view invited users" },
        { status: 403 },
      );
    }

    const adminRoleId = getCoreRoleId("admin");
    const accountantRoleId = getCoreRoleId("accountant");
    const clientRoleId = getCoreRoleId("client");

    const filteredUsers = requesterRole === "SUPER_ADMIN"
      ? await listApiDirectoryUsers(apiToken, {
          roleIds: adminRoleId ? [adminRoleId] : [],
        })
      : await listApiDirectoryUsers(apiToken, {
          orgId: requester?.orgId || "",
          roleIds: [accountantRoleId, clientRoleId].filter(
            (value): value is number => value !== null,
          ),
        });

    const organizations = await listCoreOrganizations(apiToken).catch(() => []);
    const organizationNameById = new Map(
      organizations.map((organization) => [organization.id, organization.name]),
    );
    const cognitoStatuses = new Map(
      await Promise.all(
        filteredUsers.map(async (user) => [
          user.email,
          await getCognitoInviteStatusByEmail(user.email),
        ] as const),
      ),
    );

    const normalizedUsers = filteredUsers.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      status: normalizeInviteStatus(
        user.status,
        cognitoStatuses.get(user.email) || "",
      ),
      name: user.fullName,
      organizationName: user.orgName || organizationNameById.get(user.orgId) || "",
      invitedByEmail: user.invitedByEmail || "",
      createdAt: user.createdAt,
    }));

    const summary = {
      total: normalizedUsers.length,
      pending: normalizedUsers.filter((user) =>
        ["INVITED", "PENDING"].includes(user.status),
      ).length,
      admins: normalizedUsers.filter((user) => user.role === "admin").length,
      accountants: normalizedUsers.filter((user) => user.role === "accountant").length,
      clients: normalizedUsers.filter((user) => user.role === "client").length,
      organizations:
        requesterRole === "SUPER_ADMIN"
          ? new Set(
              normalizedUsers
                .map((user) => user.organizationName)
                .filter(Boolean),
            ).size
          : requester?.orgId
            ? 1
            : 0,
    };

    return NextResponse.json({
      summary,
      users: normalizedUsers,
    });
  } catch (error) {
    console.error("Fetch invited users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invited users" },
      { status: 500 },
    );
  }
}
