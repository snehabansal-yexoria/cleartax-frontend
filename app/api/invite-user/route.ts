import { NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { verifyToken } from "../../../src/lib/verifyToken";
import { pool } from "../../../src/lib/db";

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

async function getUserColumns() {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'users'
       AND column_name = ANY($1::text[])`,
    [["invited_by", "full_name", "phone_number"]],
  );

  return new Set(result.rows.map((row) => String(row.column_name)));
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { email, role, organization_id, full_name, phone_number } = body;
    const requestedRole = String(role || "").toLowerCase();

    // 🔥 STEP 1: Get logged-in user
    const userResult = await pool.query(
      "SELECT id, role, organization_id FROM users WHERE cognito_user_id = $1",
      [decoded.sub],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUser = userResult.rows[0];
    const inviterRole = String(currentUser.role || "").toUpperCase();

    const allowedInvites: Record<string, string[]> = {
      SUPER_ADMIN: ["admin"],
      ADMIN: ["accountant", "client"],
      ACCOUNTANT: ["client"],
    };

    if (!allowedInvites[inviterRole]?.includes(requestedRole)) {
      return NextResponse.json(
        { error: "You are not allowed to invite this role" },
        { status: 403 },
      );
    }

    // 🔥 STEP 2: Determine organization
    let finalOrgId = organization_id;

    if (inviterRole === "ADMIN" || inviterRole === "ACCOUNTANT") {
      finalOrgId = currentUser.organization_id;
    }

    if (!finalOrgId) {
      return NextResponse.json(
        { error: "Organization is required" },
        { status: 400 },
      );
    }

    // 🔥 STEP 3: Create user in Cognito
    const tempPassword = Math.random().toString(36).slice(-8) + "A1!";

    const command = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email,
      TemporaryPassword: tempPassword,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "custom:role", Value: requestedRole },
      ],
    });

    const response = await client.send(command);

    const cognitoSub = response.User?.Attributes?.find(
      (attr) => attr.Name === "sub",
    )?.Value;

    // 🔥 STEP 4: Save in DB
    const userColumns = await getUserColumns();

    if (
      userColumns.has("invited_by") ||
      userColumns.has("full_name") ||
      userColumns.has("phone_number")
    ) {
      const insertColumns = [
        "cognito_user_id",
        "email",
        "role",
        "organization_id",
        "status",
      ];
      const insertValues = [
        cognitoSub,
        email,
        requestedRole.toUpperCase(),
        finalOrgId,
        "INVITED",
      ];

      if (userColumns.has("invited_by")) {
        insertColumns.push("invited_by");
        insertValues.push(currentUser.id);
      }

      if (userColumns.has("full_name")) {
        insertColumns.push("full_name");
        insertValues.push(full_name || null);
      }

      if (userColumns.has("phone_number")) {
        insertColumns.push("phone_number");
        insertValues.push(phone_number || null);
      }

      const placeholders = insertValues.map((_, index) => `$${index + 1}`);

      await pool.query(
        `INSERT INTO users (${insertColumns.join(", ")})
         VALUES (${placeholders.join(", ")})`,
        insertValues,
      );
    } else {
      await pool.query(
        `INSERT INTO users (cognito_user_id, email, role, organization_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [cognitoSub, email, requestedRole.toUpperCase(), finalOrgId, "INVITED"],
      );
    }

    return NextResponse.json({
      success: true,
      temporaryPassword: tempPassword,
    });
  } catch (error: unknown) {
    console.error("Invite error:", error);

    const details =
      error instanceof Error ? error.message : "Unexpected server error";

    return NextResponse.json(
      {
        error: "Database error",
        details,
      },
      { status: 500 },
    );
  }
}
