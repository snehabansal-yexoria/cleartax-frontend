import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { pool } from "@/src/lib/db";
import {
  findDirectoryUserByIdentity,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";

type HistoryRow = {
  id: string;
  client_user_id: string;
  org_id: string;
  from_accountant_id: string | null;
  from_accountant_name: string | null;
  from_accountant_email: string | null;
  to_accountant_id: string | null;
  to_accountant_name: string | null;
  to_accountant_email: string | null;
  transferred_by: string;
  transferred_by_name: string | null;
  transferred_by_email: string | null;
  reason: string | null;
  transferred_at: Date;
};

export async function GET(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = (await verifyToken(token)) as VerifiedTokenLike | null;

    if (!decoded?.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const requester = await findDirectoryUserByIdentity({
      id: decoded.sub,
      email: decoded.email,
    });

    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requesterRole = requester.role.toLowerCase();

    if (!["admin", "accountant"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "You are not allowed to view client history" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json(
        { error: "Organization missing" },
        { status: 400 },
      );
    }

    const params = await context.params;
    const clientId = String(params.clientId || "").trim();

    if (!clientId) {
      return NextResponse.json(
        { error: "Client id is required" },
        { status: 400 },
      );
    }

    const result = await pool.query<HistoryRow>(
      `SELECT
         h.id,
         h.client_user_id,
         h.org_id,
         h.from_accountant_id,
         fa.full_name  AS from_accountant_name,
         fa.email      AS from_accountant_email,
         h.to_accountant_id,
         ta.full_name  AS to_accountant_name,
         ta.email      AS to_accountant_email,
         h.transferred_by,
         tb.full_name  AS transferred_by_name,
         tb.email      AS transferred_by_email,
         h.reason,
         h.transferred_at
       FROM client_accountant_history h
       LEFT JOIN users fa ON fa.id = h.from_accountant_id
       LEFT JOIN users ta ON ta.id = h.to_accountant_id
       LEFT JOIN users tb ON tb.id = h.transferred_by
       WHERE h.client_user_id = $1
         AND h.org_id = $2::uuid
       ORDER BY h.transferred_at DESC`,
      [clientId, requester.orgId],
    );

    return NextResponse.json({
      history: result.rows.map((row) => ({
        id: String(row.id),
        clientUserId: row.client_user_id,
        fromAccountant: row.from_accountant_id
          ? {
              id: row.from_accountant_id,
              name: row.from_accountant_name,
              email: row.from_accountant_email,
            }
          : null,
        toAccountant: row.to_accountant_id
          ? {
              id: row.to_accountant_id,
              name: row.to_accountant_name,
              email: row.to_accountant_email,
            }
          : null,
        transferredBy: {
          id: row.transferred_by,
          name: row.transferred_by_name,
          email: row.transferred_by_email,
        },
        reason: row.reason ?? null,
        transferredAt: new Date(row.transferred_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error("Fetch client history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch client history" },
      { status: 500 },
    );
  }
}
