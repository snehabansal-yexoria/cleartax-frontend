import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import {
  findDirectoryUserByIdentity,
  listDirectoryUsers,
} from "../../../../../src/lib/userDirectory";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = await verifyToken(idToken);

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const currentUser = await findDirectoryUserByIdentity({
      id: String(decoded.sub || ""),
      email: String(decoded.email || ""),
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const usersInOrg = currentUser.orgId
      ? await listDirectoryUsers({ orgId: currentUser.orgId })
      : [];

    const assignedAccountant = currentUser.assignedAccountantId
      ? usersInOrg.find((user) => user.id === currentUser.assignedAccountantId)
      : null;

    const fallbackAdmin = usersInOrg.find((user) => user.role === "admin") || null;

    return NextResponse.json({
      company: currentUser.orgName
        ? {
            id: currentUser.orgId,
            name: currentUser.orgName,
          }
        : null,
      managedBy: assignedAccountant
        ? {
            id: assignedAccountant.id,
            name: assignedAccountant.fullName,
            email: assignedAccountant.email,
            role: "accountant",
          }
        : fallbackAdmin
          ? {
              id: fallbackAdmin.id,
              name: fallbackAdmin.fullName,
              email: fallbackAdmin.email,
              role: fallbackAdmin.role,
            }
          : null,
    });
  } catch (error) {
    console.error("Fetch client context error:", error);
    return NextResponse.json(
      { error: "Failed to fetch client context" },
      { status: 500 },
    );
  }
}
