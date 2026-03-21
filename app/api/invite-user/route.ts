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
    const { email, role, organization_id } = body;

    // 🔥 STEP 1: Get logged-in user
    const userResult = await pool.query(
      "SELECT id, role, organization_id FROM users WHERE cognito_user_id = $1",
      [decoded.sub],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUser = userResult.rows[0];

    // 🔥 STEP 2: Determine organization
    let finalOrgId = organization_id;

    if (currentUser.role === "ADMIN") {
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
      ],
    });

    const response = await client.send(command);

    const cognitoSub = response.User?.Attributes?.find(
      (attr) => attr.Name === "sub",
    )?.Value;

    // 🔥 STEP 4: Save in DB
    await pool.query(
      `INSERT INTO users (cognito_user_id, email, role, organization_id, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [cognitoSub, email, role.toUpperCase(), finalOrgId, "INVITED"],
    );

    return NextResponse.json({
      success: true,
      temporaryPassword: tempPassword,
    });
  } catch (error: any) {
    console.error("Invite error:", error);

    return NextResponse.json(
      {
        error: "Database error",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
