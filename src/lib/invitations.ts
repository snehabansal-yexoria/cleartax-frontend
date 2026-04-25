import { randomBytes } from "crypto";
import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  createCoreUser,
  getCoreOrganizationById,
  getCoreRoleId,
  listCoreOrganizations,
} from "./coreApi";
import { findDirectoryUserByIdentity } from "./userDirectory";

export type InviteVerifiedToken = {
  sub?: string;
  email?: string;
  name?: string;
  "custom:role"?: string;
};

type InviteInput = {
  inviter: InviteVerifiedToken;
  apiToken: string;
  email: string;
  requestedRole: string;
  organizationId?: string;
  fullName?: string;
};

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

function getDisplayName(value: string) {
  return value
    .replace(/[._-]/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function generateCognitoUsername(email: string) {
  const localPart = (email.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  return `${localPart || "user"}_${randomBytes(4).toString("hex")}`;
}

function makeHttpError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function resolveInviterOrgId(apiToken: string, inviterEmail: string) {
  const inviter = await findDirectoryUserByIdentity({
    email: inviterEmail,
  }).catch(() => null);

  if (inviter?.orgId) {
    return inviter.orgId;
  }

  return "";
}

async function resolveOrganizationId(
  apiToken: string,
  inviterRole: string,
  inviterEmail: string,
  requestedOrganizationId: string,
) {
  if (inviterRole === "SUPER_ADMIN") {
    return requestedOrganizationId;
  }

  return resolveInviterOrgId(apiToken, inviterEmail);
}

export async function inviteUser(input: InviteInput) {
  const inviterEmail = String(input.inviter.email || "").trim().toLowerCase();
  const email = String(input.email || "").trim().toLowerCase();
  const requestedRole = String(input.requestedRole || "").trim().toLowerCase();
  const organizationId = String(input.organizationId || "").trim();
  const fullName = String(input.fullName || "").trim();
  const apiToken = String(input.apiToken || "").trim();

  if (!input.inviter.sub || !inviterEmail) {
    throw new Error("Invalid inviter token");
  }

  if (!apiToken) {
    throw makeHttpError("Missing backend API token", 400);
  }

  if (!email || !requestedRole) {
    throw new Error("Email and role are required");
  }

  const inviterRole = String(input.inviter["custom:role"] || "")
    .trim()
    .toUpperCase();

  const allowedInvites: Record<string, string[]> = {
    SUPER_ADMIN: ["admin"],
    ADMIN: ["accountant", "client"],
    ACCOUNTANT: ["client"],
  };

  if (!allowedInvites[inviterRole]?.includes(requestedRole)) {
    throw makeHttpError("You are not allowed to invite this role", 403);
  }

  const finalOrgId = await resolveOrganizationId(
    apiToken,
    inviterRole,
    inviterEmail,
    organizationId,
  );

  if (!finalOrgId) {
    throw makeHttpError("Organization is required", 400);
  }

  try {
    await getCoreOrganizationById(apiToken, finalOrgId);
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;

    if (status === 404 || status === 400) {
      throw makeHttpError("Selected organization does not exist", 404);
    }

    throw error;
  }

  const tempPassword = `${Math.random().toString(36).slice(-8)}A1!`;
  const cognitoUsername = generateCognitoUsername(email);

  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: cognitoUsername,
      TemporaryPassword: tempPassword,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: fullName || getDisplayName(email) },
        { Name: "custom:role", Value: requestedRole },
      ],
    }),
  );

  const roleId = getCoreRoleId(requestedRole);

  if (!roleId) {
    throw new Error(`Missing role mapping for ${requestedRole}`);
  }

  const inviteeName = fullName || getDisplayName(email.split("@")[0] || requestedRole);
  const createUserPayload = {
    email,
    full_name: inviteeName,
    role_id: roleId,
    org_id: finalOrgId,
  };

  console.log(
    "Invite createCoreUser payload:",
    JSON.stringify(createUserPayload, null, 2),
  );

  try {
    const user = await createCoreUser(apiToken, createUserPayload);

    return {
      success: true,
      temporaryPassword: tempPassword,
      userId: user.id,
      organizationId: finalOrgId,
    };
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;

    if (status === 409) {
      throw makeHttpError("A user with this email already exists", 409);
    }

    throw error;
  }
}

export async function findOrganizationIdByNameOrId(
  apiToken: string,
  value: string,
) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  const organizations = await listCoreOrganizations(apiToken);
  return (
    organizations.find(
      (organization) =>
        organization.id === normalizedValue ||
        organization.name.toLowerCase() === normalizedValue.toLowerCase(),
    )?.id || ""
  );
}
