import { randomBytes } from "crypto";
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  createCoreUser,
  getCoreOrganizationById,
  getCoreRoleId,
  listCoreOrganizations,
  listCoreUsers,
  updateCoreUser,
  type CoreUser,
} from "./coreApi";
import { findApiDirectoryUserByIdentity } from "./coreUserDirectory";

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

type InviteResult = {
  success: true;
  temporaryPassword: string;
  userId: string;
  organizationId: string;
  alreadyInvited?: boolean;
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

function escapeCognitoFilterValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function findCognitoUsernameByEmail(email: string) {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!userPoolId || !normalizedEmail) {
    return "";
  }

  const response = await client.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${escapeCognitoFilterValue(normalizedEmail)}"`,
      Limit: 1,
    }),
  );

  return response.Users?.[0]?.Username || "";
}

async function resolveInviterOrgId(apiToken: string, inviterEmail: string) {
  const inviter = await findApiDirectoryUserByIdentity(apiToken, {
    email: inviterEmail,
  }).catch(() => null);

  return inviter?.orgId || "";
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

function isSameInvite(user: CoreUser, params: {
  email: string;
  requestedRole: string;
  organizationId: string;
}) {
  return (
    user.email.toLowerCase() === params.email &&
    user.orgId === params.organizationId &&
    user.role.toLowerCase() === params.requestedRole
  );
}

async function findReusableExistingInvite(params: {
  apiToken: string;
  email: string;
  requestedRole: string;
  organizationId: string;
}) {
  const users = await listCoreUsers(params.apiToken).catch(() => []);
  return users.find((user) => isSameInvite(user, params)) || null;
}

async function findExistingUserByEmail(apiToken: string, email: string) {
  const users = await listCoreUsers(apiToken).catch(() => []);
  return users.find((user) => user.email.toLowerCase() === email) || null;
}

async function createCognitoInvite(params: {
  email: string;
  fullName: string;
  requestedRole: string;
  temporaryPassword: string;
}) {
  try {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: generateCognitoUsername(params.email),
        TemporaryPassword: params.temporaryPassword,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: params.email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: params.fullName },
          { Name: "custom:role", Value: params.requestedRole },
        ],
      }),
    );
  } catch (error) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "";

    if (
      errorName !== "UsernameExistsException" &&
      errorName !== "AliasExistsException"
    ) {
      throw error;
    }

    const username = await findCognitoUsernameByEmail(params.email);

    if (username) {
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: username,
          Password: params.temporaryPassword,
          Permanent: false,
        }),
      );
    }
  }
}

export async function inviteUser(input: InviteInput): Promise<InviteResult> {
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

  const tempPassword = `${Math.random().toString(36).slice(-8)}A1!`;
  const inviteeName =
    fullName || getDisplayName(email.split("@")[0] || requestedRole);

  const existingInvite = await findReusableExistingInvite({
    apiToken,
    email,
    requestedRole,
    organizationId: finalOrgId,
  });

  if (existingInvite) {
    await createCognitoInvite({
      email,
      fullName: existingInvite.fullName || inviteeName,
      requestedRole,
      temporaryPassword: tempPassword,
    });

    return {
      success: true,
      temporaryPassword: tempPassword,
      userId: existingInvite.id,
      organizationId: finalOrgId,
      alreadyInvited: true,
    };
  }

  const existingUser = await findExistingUserByEmail(apiToken, email);

  if (existingUser && existingUser.orgId !== finalOrgId) {
    throw makeHttpError(
      "A user with this email already exists in another organization",
      409,
    );
  }

  await getCoreOrganizationById(apiToken, finalOrgId).catch((error) => {
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
  });

  const roleId = getCoreRoleId(requestedRole);

  if (!roleId) {
    throw new Error(`Missing role mapping for ${requestedRole}`);
  }

  await createCognitoInvite({
    email,
    fullName: inviteeName,
    requestedRole,
    temporaryPassword: tempPassword,
  });

  try {
    const user = await createCoreUser(apiToken, {
      email,
      full_name: inviteeName,
      role_id: roleId,
      org_id: finalOrgId,
    });

    await updateCoreUser(apiToken, user.id, {
      is_active: false,
    }).catch(() => null);

    await updateCoreUser(apiToken, user.id, {
      status: "pending",
    }).catch(() => null);

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
      const existingUserAfterConflict = await findReusableExistingInvite({
        apiToken,
        email,
        requestedRole,
        organizationId: finalOrgId,
      });

      if (existingUserAfterConflict) {
        return {
          success: true,
          temporaryPassword: tempPassword,
          userId: existingUserAfterConflict.id,
          organizationId: finalOrgId,
          alreadyInvited: true,
        };
      }

      return {
        success: true,
        temporaryPassword: tempPassword,
        userId: existingUser?.id || email,
        organizationId: finalOrgId,
        alreadyInvited: true,
      };
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
