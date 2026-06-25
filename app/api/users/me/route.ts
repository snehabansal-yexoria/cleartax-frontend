import { NextResponse } from "next/server";
import { normalizeRoleName } from "@/src/lib/roleNames";
import {
  findDirectoryUserByIdentity,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import { verifyToken } from "@/src/lib/verifyToken";
import { getRequestToken } from "@/src/lib/coreApiProxy";
import { pool } from "@/src/lib/db";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const appAccessKeyId = process.env.APP_ACCESS_KEY_ID;
const appSecretAccessKey = process.env.APP_SECRET_ACCESS_KEY;
const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID;

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.APP_REGION || process.env.AWS_REGION || "ap-southeast-2",
  ...(appAccessKeyId && appSecretAccessKey
    ? {
        credentials: {
          accessKeyId: appAccessKeyId,
          secretAccessKey: appSecretAccessKey,
        },
      }
    : {}),
});

function getBackendUrl() {
  const base =
    process.env.CORE_API_BASE_URL || process.env.NEXT_PUBLIC_CORE_API_BASE_URL;
  if (!base) throw new Error("CORE_API_BASE_URL is not configured");
  return base.replace(/\/+$/, "");
}

export async function GET(req: Request) {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    // Rebuild the bearer header for forwarding: the inbound Authorization
    // header may have been stripped (Amplify) and the token taken from cookie.
    const authHeader = `Bearer ${token}`;

    const upstream = await fetch(`${getBackendUrl()}/users/me`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const body = await upstream.text();
    const data = body ? JSON.parse(body) : null;

    if (!upstream.ok) {
      return NextResponse.json(data ?? { error: upstream.statusText }, {
        status: upstream.status,
      });
    }

    const decoded = token
      ? ((await verifyToken(token)) as VerifiedTokenLike | null)
      : null;
    const directoryUser = await findDirectoryUserByIdentity({
      id: decoded?.sub || data?.id,
      email: decoded?.email || data?.email,
    });
    const role = normalizeRoleName(
      data.role_name || data.role || directoryUser?.role,
    );

    // Go backend returns snake_case; normalize to the camelCase shape the
    // frontend already consumes (see dashboard/layout.tsx, LoginComponent).
    return NextResponse.json({
      id: data.id || directoryUser?.id || decoded?.sub || "",
      email: data.email || directoryUser?.email || decoded?.email || "",
      fullName:
        data.full_name ||
        data.fullName ||
        directoryUser?.fullName ||
        decoded?.name ||
        "",
      role,
      roleId: data.role_id ?? directoryUser?.roleId ?? null,
      orgId: data.org_id || data.orgId || directoryUser?.orgId || "",
      orgName: data.org_name || data.orgName || directoryUser?.orgName || "",
      status: data.status || directoryUser?.status || "",
      phoneNumber:
        data.phone_number ||
        data.phone ||
        data.phoneNumber ||
        directoryUser?.phoneNumber ||
        "",
    });
  } catch (error) {
    console.error("Proxy /users/me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch current user" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const authHeader = `Bearer ${token}`;
    const decoded = (await verifyToken(token)) as VerifiedTokenLike | null;

    if (!decoded || (!decoded.sub && !decoded.email)) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    // 1. Fetch current user from Go backend to get the exact database user ID
    const meRes = await fetch(`${getBackendUrl()}/users/me`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    let userId = "";
    if (meRes.ok) {
      const meBody = await meRes.text();
      const meData = meBody ? JSON.parse(meBody) : null;
      userId = meData?.id || "";
    }

    // Fallback: search by email/sub in local database directory
    if (!userId) {
      const directoryUser = await findDirectoryUserByIdentity({
        id: decoded.sub,
        email: decoded.email,
      });
      userId = directoryUser?.id || "";
    }

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { phoneNumber, fullName } = body;

    let responseData: any = null;

    // Cognito phone number update if phoneNumber is specified
    if (phoneNumber !== undefined) {
      let sanitizedPhone = String(phoneNumber).trim().replace(/[^\d+]/g, "");

      if (sanitizedPhone) {
        if (!sanitizedPhone.startsWith("+")) {
          return NextResponse.json(
            { error: "Phone number must start with '+' and include country code (e.g. +61491570156 or +919876543210)." },
            { status: 400 }
          );
        }

        try {
          await cognitoClient.send(
            new AdminUpdateUserAttributesCommand({
              UserPoolId: cognitoUserPoolId,
              Username: decoded.email,
              UserAttributes: [
                { Name: "phone_number", Value: sanitizedPhone },
              ],
            })
          );
        } catch (cognitoErr: any) {
          console.error("Cognito phone number update error:", cognitoErr);
          return NextResponse.json(
            { error: cognitoErr.message || "Failed to update phone number in Cognito." },
            { status: 400 }
          );
        }
      }
    }

    // Call Go backend PATCH /users/{id} to update in Cognito/backend database ONLY if fullName is provided
    if (fullName !== undefined) {
      const updateBody = {
        full_name: fullName
      };

      const res = await fetch(
        `${getBackendUrl()}/users/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(updateBody),
          cache: "no-store",
        },
      );

      const responseText = await res.text();
      responseData = responseText ? JSON.parse(responseText) : null;

      if (!res.ok) {
        return NextResponse.json(
          responseData ?? { error: res.statusText },
          { status: res.status },
        );
      }
    }

    // 4. Sync the updated full_name with local Postgres database to avoid inconsistencies
    if (fullName) {
      await pool
        .query(
          `UPDATE users
         SET full_name = $1
         WHERE id = $2 OR lower(email) = $3`,
          [fullName, userId, (decoded.email || "").toLowerCase()],
        )
        .catch((err) => {
          console.error("Failed to sync updated full name to PG db:", err);
        });
    }

    // Sync the updated phone_number with local Postgres database
    if (phoneNumber !== undefined) {
      let sanitizedPhone = String(phoneNumber).trim().replace(/[^\d+]/g, "");
      await pool
        .query(
          `UPDATE users
         SET phone_number = $1
         WHERE id = $2 OR lower(email) = $3`,
          [sanitizedPhone, userId, (decoded.email || "").toLowerCase()],
        )
        .catch((err) => {
          console.error("Failed to sync updated phone number to PG db:", err);
        });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: responseData?.id || userId,
        email: responseData?.email || decoded.email || "",
        fullName: responseData?.full_name || responseData?.fullName || fullName || "",
        phoneNumber: phoneNumber !== undefined ? String(phoneNumber).trim().replace(/[^\d+]/g, "") : (responseData?.phone_number || responseData?.phone || responseData?.phoneNumber || ""),
      },
    });
  } catch (error) {
    console.error("Proxy PATCH /users/me error:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 },
    );
  }
}

