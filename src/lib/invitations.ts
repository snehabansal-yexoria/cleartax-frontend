import { randomBytes } from "crypto";
import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  getCoreRoleId,
  listCoreOrganizations,
} from "./coreApi";
import { pool } from "./db";
import {
  findDirectoryUserByIdentity,
  getOrganizationById,
} from "./userDirectory";

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

type Queryable = {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<{
    rows: T[];
    rowCount: number | null;
  }>;
};

async function generateLocalUserId(db: Queryable) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomBytes(5).toString("hex").toUpperCase();
    const result = await db.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [candidate],
    );

    if ((result.rowCount || 0) === 0) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a local user id");
}

async function ensureLocalUserRecord(
  db: Queryable,
  params: {
    email: string;
    fullName: string;
  },
) {
  const existingUserResult = await db.query<{
    id: string;
    full_name: string | null;
  }>(
    `SELECT id, full_name
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [params.email],
  );

  const existingUser = existingUserResult.rows[0] || null;

  if (existingUser) {
    if (!existingUser.full_name && params.fullName) {
      await db.query(
        `UPDATE users
         SET full_name = $2
         WHERE id = $1`,
        [existingUser.id, params.fullName],
      );
    }

    return existingUser.id;
  }

  const userId = await generateLocalUserId(db);

  await db.query(
    `INSERT INTO users (id, email, full_name, is_active)
     VALUES ($1, $2, $3, true)`,
    [userId, params.email, params.fullName],
  );

  return userId;
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

async function findReusableExistingInvite(params: {
  email: string;
  requestedRole: string;
  organizationId: string;
}) {
  const normalizedRequestedRole = params.requestedRole.trim().toLowerCase();

  const existingDirectoryUser = await findDirectoryUserByIdentity({
    email: params.email,
  }).catch(() => null);

  if (existingDirectoryUser) {
    const normalizedExistingRole = String(existingDirectoryUser.role || "")
      .trim()
      .toLowerCase();
    const normalizedStatus = String(existingDirectoryUser.status || "")
      .trim()
      .toUpperCase();

    if (
      existingDirectoryUser.orgId === params.organizationId &&
      normalizedExistingRole === normalizedRequestedRole &&
      ["PENDING", "INVITED", "ACCEPTED", "ACTIVE"].includes(normalizedStatus)
    ) {
      return existingDirectoryUser;
    }
  }

  return null;
}

async function findExistingUserWithRole(params: {
  email: string;
  requestedRoleId: number;
  organizationId: string;
}) {
  const result = await pool.query<{
    id: string;
    full_name: string | null;
    role_id: number | string | null;
    org_id: string;
    invitation_status: string | null;
    accepted_at: Date | string | null;
  }>(
    `SELECT
       u.id,
       u.full_name,
       m.role_id,
       m.org_id,
       inv.status AS invitation_status,
       inv.accepted_at
     FROM users u
     LEFT JOIN org_user_mapping m
       ON m.user_id = u.id
      AND m.org_id = $2::uuid
     LEFT JOIN LATERAL (
       SELECT status, accepted_at
       FROM user_invitation
       WHERE lower(email) = lower(u.email)
         AND org_id = $2::uuid
         AND role_id = $3
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1
     ) inv ON true
     WHERE lower(u.email) = lower($1)
     LIMIT 1`,
    [params.email, params.organizationId, params.requestedRoleId],
  );

  return result.rows[0] || null;
}

async function ensureLocalInviteRecord(params: {
  email: string;
  fullName: string;
  roleId: number;
  organizationId: string;
  invitedByEmail: string;
  invitedByName: string;
}) {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");
    const invitedByUserId = await ensureLocalUserRecord(dbClient, {
      email: params.invitedByEmail,
      fullName: params.invitedByName,
    });
    const userId = await ensureLocalUserRecord(dbClient, {
      email: params.email,
      fullName: params.fullName,
    });

    const mappingResult = await dbClient.query<{ id: number }>(
      `SELECT id
       FROM org_user_mapping
       WHERE user_id = $1
         AND org_id = $2::uuid
         AND role_id = $3
       LIMIT 1`,
      [userId, params.organizationId, params.roleId],
    );

    if ((mappingResult.rowCount || 0) === 0) {
      await dbClient.query(
        `INSERT INTO org_user_mapping (org_id, user_id, role_id, status)
         VALUES ($1::uuid, $2, $3, 'active')`,
        [params.organizationId, userId, params.roleId],
      );
    }

    const invitationResult = await dbClient.query<{
      id: string;
      status: string | null;
      accepted_at: Date | string | null;
    }>(
      `SELECT id, status, accepted_at
       FROM user_invitation
       WHERE lower(email) = lower($1)
         AND org_id = $2::uuid
         AND role_id = $3
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1`,
      [params.email, params.organizationId, params.roleId],
    );

    const existingInvitation = invitationResult.rows[0] || null;
    const normalizedInvitationStatus = String(
      existingInvitation?.accepted_at
        ? "accepted"
        : existingInvitation?.status || "",
    )
      .trim()
      .toUpperCase();

    if (["PENDING", "INVITED", "ACCEPTED"].includes(normalizedInvitationStatus)) {
      await dbClient.query("COMMIT");
      return {
        userId,
        alreadyInvited: true,
      };
    }

    const invitationToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await dbClient.query(
      `INSERT INTO user_invitation (
         org_id,
         email,
         role_id,
         invitation_token,
         status,
         expires_at,
         invited_by
       )
       VALUES ($1::uuid, $2, $3, $4, 'pending', $5, $6)`,
      [
        params.organizationId,
        params.email,
        params.roleId,
        invitationToken,
        expiresAt,
        invitedByUserId,
      ],
    );

    await dbClient.query("COMMIT");

    return {
      userId,
      alreadyInvited: false,
    };
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
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

  const existingUserByEmail = await findDirectoryUserByIdentity({
    email,
  }).catch(() => null);

  if (
    existingUserByEmail?.orgId &&
    existingUserByEmail.orgId !== finalOrgId
  ) {
    throw makeHttpError(
      "A user with this email already exists in another organization",
      409,
    );
  }

  const existingInvite = await findReusableExistingInvite({
    email,
    requestedRole,
    organizationId: finalOrgId,
  });

  if (existingInvite) {
    return {
      success: true,
      temporaryPassword: "",
      userId: existingInvite.id,
      organizationId: finalOrgId,
      alreadyInvited: true,
    };
  }

  const organization = await getOrganizationById(finalOrgId);

  if (!organization) {
    throw makeHttpError("Selected organization does not exist", 404);
  }

  const tempPassword = `${Math.random().toString(36).slice(-8)}A1!`;
  const roleId = getCoreRoleId(requestedRole);

  if (!roleId) {
    throw new Error(`Missing role mapping for ${requestedRole}`);
  }

  const inviteeName = fullName || getDisplayName(email.split("@")[0] || requestedRole);

  try {
    const cognitoUsername = generateCognitoUsername(email);

    try {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: cognitoUsername,
          TemporaryPassword: tempPassword,
          MessageAction: "SUPPRESS",
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
            { Name: "name", Value: inviteeName },
            { Name: "custom:role", Value: requestedRole },
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
    }

    const record = await ensureLocalInviteRecord({
      email,
      fullName: inviteeName,
      roleId,
      organizationId: finalOrgId,
      invitedByEmail: inviterEmail,
      invitedByName:
        String(input.inviter.name || "").trim() || getDisplayName(inviterEmail),
    });

    return {
      success: true,
      temporaryPassword: record.alreadyInvited ? "" : tempPassword,
      userId: record.userId,
      organizationId: finalOrgId,
      alreadyInvited: record.alreadyInvited,
    };
  } catch (error) {
    const existingUser = await findExistingUserWithRole({
      email,
      requestedRoleId: roleId,
      organizationId: finalOrgId,
    });

    if (existingUser) {
      return {
        success: true,
        temporaryPassword: "",
        userId: existingUser.id,
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
