import { NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { verifyToken } from "../../../src/lib/verifyToken";

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const payload: any = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const role = payload["custom:role"];

    if (role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: only super_admin can invite users" },
        { status: 403 },
      );
    }

    const { email, role: newUserRole } = await req.json();

    const command = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,

      Username: email,

      TemporaryPassword: "TempPassword123!",

      UserAttributes: [
        {
          Name: "email",
          Value: email,
        },
        {
          Name: "email_verified",
          Value: "true",
        },
        {
          Name: "custom:role",
          Value: newUserRole,
        },
      ],

      MessageAction: "SUPPRESS",
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      temporaryPassword: "TempPassword123!",
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
