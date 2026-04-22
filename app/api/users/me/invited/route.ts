import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import { getCoreRoleId } from "../../../../../src/lib/coreApi";
import { backfillAcceptedInvitationByEmail } from "../../../../../src/lib/invitations";
import {
  findDirectoryUserByIdentity,
  listDirectoryUsers,
  type VerifiedTokenLike,
} from "../../../../../src/lib/userDirectory";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = (await verifyToken(token)) as VerifiedTokenLike | null;

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const requesterRole = String(decoded["custom:role"] || "").toUpperCase();

    if (!["SUPER_ADMIN", "ADMIN"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "You are not allowed to view invited users" },
        { status: 403 },
      );
    }

    const requester =
      requesterRole === "SUPER_ADMIN"
        ? await findDirectoryUserByIdentity({
            id: decoded.sub,
            email: decoded.email,
          })
        : await findDirectoryUserByIdentity({
            id: decoded.sub,
            email: decoded.email,
          });

    if (requesterRole === "ADMIN" && !requester?.orgId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const adminRoleId = getCoreRoleId("admin");
    const accountantRoleId = getCoreRoleId("accountant");
    const clientRoleId = getCoreRoleId("client");

    const roleIds =
      requesterRole === "SUPER_ADMIN"
        ? [adminRoleId]
        : [accountantRoleId, clientRoleId];

    if (roleIds.some((value) => !value)) {
      return NextResponse.json(
        { error: "Role mapping is not configured" },
        { status: 500 },
      );
    }

    const filteredUsers = await listDirectoryUsers({
      orgId: requesterRole === "ADMIN" ? requester?.orgId : undefined,
      roleIds: roleIds as number[],
    });

    await Promise.all(
      filteredUsers
        .filter((user) => ["PENDING", "INVITED"].includes(user.status))
        .map(async (user) => {
          const wasBackfilled = await backfillAcceptedInvitationByEmail(user.email);

          if (wasBackfilled) {
            user.status = "ACCEPTED";
          }
        }),
    );

    const normalizedUsers = filteredUsers.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status || "INVITED",
      name: user.fullName,
      organizationName: user.orgName || "",
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

    console.log(
      "Invited users response:",
      JSON.stringify(
        {
          summary,
          users: normalizedUsers,
        },
        null,
        2,
      ),
    );

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
