import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { pool } from "@/src/lib/db";
import {
  findDirectoryUserByIdentity,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";

export async function POST(req: Request) {
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
        { error: "Only admins and accountants can transfer clients" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json(
        { error: "Organization missing" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      clientId?: unknown;
      toAccountantId?: unknown;
      reason?: unknown;
    };

    const clientId = String(body.clientId || "").trim();
    const toAccountantId = String(body.toAccountantId || "").trim();
    const reason =
      typeof body.reason === "string" ? body.reason.trim() : undefined;

    if (!clientId || !toAccountantId) {
      return NextResponse.json(
        { error: "clientId and toAccountantId are required" },
        { status: 400 },
      );
    }

    if (clientId === toAccountantId) {
      return NextResponse.json(
        { error: "Cannot transfer a client to themselves" },
        { status: 400 },
      );
    }

    const dbClient = await pool.connect();

    try {
      await dbClient.query("BEGIN");

      const clientRow = await dbClient.query<{
        id: string;
        org_id: string;
        assigned_accountant_id: string | null;
      }>(
        `SELECT u.id, m.org_id, u.assigned_accountant_id
         FROM users u
         JOIN org_user_mapping m ON m.user_id = u.id
         WHERE u.id = $1
           AND m.org_id = $2::uuid
           AND m.role_id = (SELECT id FROM roles WHERE role_name = 'client' LIMIT 1)
         FOR UPDATE OF u`,
        [clientId, requester.orgId],
      );

      if (clientRow.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        return NextResponse.json(
          { error: "Client not found in your organization" },
          { status: 404 },
        );
      }

      const currentClient = clientRow.rows[0];

      if (
        requesterRole === "accountant" &&
        currentClient.assigned_accountant_id !== requester.id
      ) {
        await dbClient.query("ROLLBACK");
        return NextResponse.json(
          { error: "You can only transfer clients assigned to you" },
          { status: 403 },
        );
      }

      const toAccountantRow = await dbClient.query<{ id: string }>(
        `SELECT u.id
         FROM users u
         JOIN org_user_mapping m ON m.user_id = u.id
         WHERE u.id = $1
           AND m.org_id = $2::uuid
           AND m.role_id = (SELECT id FROM roles WHERE role_name = 'accountant' LIMIT 1)
         LIMIT 1`,
        [toAccountantId, requester.orgId],
      );

      if (toAccountantRow.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        return NextResponse.json(
          { error: "Target accountant not found in your organization" },
          { status: 404 },
        );
      }

      await dbClient.query(
        `UPDATE users
         SET assigned_accountant_id = $1,
             assigned_at = NOW()
         WHERE id = $2`,
        [toAccountantId, clientId],
      );

      await dbClient.query(
        `INSERT INTO client_accountant_history
           (client_user_id, org_id, from_accountant_id, to_accountant_id, transferred_by, reason)
         VALUES ($1, $2::uuid, $3, $4, $5, $6)`,
        [
          clientId,
          requester.orgId,
          currentClient.assigned_accountant_id ?? null,
          toAccountantId,
          requester.id,
          reason ?? null,
        ],
      );

      await dbClient.query("COMMIT");

      return NextResponse.json({ success: true });
    } catch (error) {
      await dbClient.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error("Transfer client error:", error);
    return NextResponse.json(
      { error: "Failed to transfer client" },
      { status: 500 },
    );
  }
}
