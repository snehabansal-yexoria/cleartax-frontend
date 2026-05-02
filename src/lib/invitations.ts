import { randomBytes } from "crypto";
import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { PoolClient, QueryResult } from "pg";
import { pool } from "./db";
import { getRoleIdByName } from "./roles";
import { findDirectoryUserByIdentity } from "./userDirectory";

export type InviteVerifiedToken = {
  sub?: string;
  email?: string;
  name?: string;
};

type InviteInput = {
  inviter: InviteVerifiedToken;
  apiToken?: string;
  email: string;
  requestedRole: string;
  organizationId?: string;
  fullName?: string;
};

const appAccessKeyId = process.env.APP_ACCESS_KEY_ID;
const appSecretAccessKey = process.env.APP_SECRET_ACCESS_KEY;

const client = new CognitoIdentityProviderClient({
  region: process.env.APP_REGION || process.env.AWS_REGION,
  ...(appAccessKeyId && appSecretAccessKey
    ? {
        credentials: {
          accessKeyId: appAccessKeyId,
          secretAccessKey: appSecretAccessKey,
        },
      }
    : {}),
});

type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<QueryResult<{ id: string }>>;
};

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

async function generateLocalUserId(db: Queryable | PoolClient = pool) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomBytes(5).toString("hex").toUpperCase();
    const existingUser = await db.query(
      `SELECT id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [candidate],
    );

    if (!existingUser.rows[0]?.id) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a unique local user id");
}

async function ensureUserRecord(params: {
  email: string;
  fullName: string;
}) {
  const existingUser = await pool.query(
    `SELECT id
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [params.email],
  );

  if (existingUser.rows[0]?.id) {
    await pool.query(
      `UPDATE users
       SET full_name = COALESCE(NULLIF($2, ''), full_name),
           is_active = true
       WHERE id = $1`,
      [existingUser.rows[0].id, params.fullName],
    );

    return existingUser.rows[0].id as string;
  }

  const userId = await generateLocalUserId();

  await pool.query(
    `INSERT INTO users (id, email, full_name, is_active)
     VALUES ($1, $2, $3, true)`,
    [userId, params.email, params.fullName],
  );

  return userId;
}

async function getUserOrgId(userId: string) {
  const mappingResult = await pool.query(
    `SELECT org_id
     FROM org_user_mapping
     WHERE user_id = $1
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [userId],
  );

  return (mappingResult.rows[0]?.org_id as string | undefined) || "";
}

export async function inviteUser(input: InviteInput) {
  const dbClient = await pool.connect();

  try {
    const inviterEmail = String(input.inviter.email || "").trim().toLowerCase();
    const email = String(input.email || "").trim().toLowerCase();
    const requestedRole = String(input.requestedRole || "").trim().toLowerCase();
    const organizationId = String(input.organizationId || "").trim();
    const fullName = String(input.fullName || "").trim();

    if (!input.inviter.sub || !inviterEmail) {
      throw new Error("Invalid inviter token");
    }

    if (!email || !requestedRole) {
      throw new Error("Email and role are required");
    }

    const inviter = await findDirectoryUserByIdentity({
      id: input.inviter.sub,
      email: inviterEmail,
    });
    const inviterRole = String(inviter?.role || "").toLowerCase();

    const allowedInvites: Record<string, string[]> = {
      super_admin: ["admin"],
      admin: ["accountant", "client"],
      accountant: ["client"],
    };

    if (!allowedInvites[inviterRole]?.includes(requestedRole)) {
      const error = new Error("You are not allowed to invite this role");
      (error as Error & { status?: number }).status = 403;
      throw error;
    }

    const inviterUserId =
      inviter?.id ||
      (await ensureUserRecord({
        email: inviterEmail,
        fullName:
          String(input.inviter.name || "").trim() ||
          getDisplayName(inviterEmail.split("@")[0] || "user"),
      }));

    let finalOrgId = organizationId;

    if (inviterRole === "admin" || inviterRole === "accountant") {
      finalOrgId = inviter?.orgId || (await getUserOrgId(inviterUserId));
    }

    if (!finalOrgId) {
      const error = new Error("Organization is required");
      (error as Error & { status?: number }).status = 400;
      throw error;
    }

    const organizationResult = await pool.query(
      `SELECT id
       FROM organisation
       WHERE id = $1
       LIMIT 1`,
      [finalOrgId],
    );

    if (!organizationResult.rows[0]?.id) {
      const error = new Error("Selected organization does not exist");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    const existingUser = await pool.query(
      `SELECT id
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email],
    );

    if (existingUser.rows[0]?.id) {
      const error = new Error("A user with this email already exists");
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const existingInvitation = await pool.query(
      `SELECT id
       FROM user_invitation
       WHERE lower(email) = lower($1)
         AND org_id = $2
         AND status = 'pending'
       LIMIT 1`,
      [email, finalOrgId],
    );

    if (existingInvitation.rows[0]?.id) {
      const error = new Error("A pending invitation already exists for this email");
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const tempPassword = `${Math.random().toString(36).slice(-8)}A1!`;
    const cognitoUsername = generateCognitoUsername(email);

    const command = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: cognitoUsername,
      TemporaryPassword: tempPassword,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
      ],
    });

    await client.send(command);

    const roleId = await getRoleIdByName(requestedRole);

    if (!roleId) {
      throw new Error(`Role ${requestedRole} does not exist in the database`);
    }

    const inviteeName =
      fullName || getDisplayName(email.split("@")[0] || requestedRole);
    const invitationToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const inviteeUserId = await generateLocalUserId(dbClient);

    await dbClient.query("BEGIN");

    await dbClient.query(
      `INSERT INTO users (id, email, full_name, is_active)
       VALUES ($1, $2, $3, true)`,
      [inviteeUserId, email, inviteeName],
    );

    await dbClient.query(
      `INSERT INTO org_user_mapping (org_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'active')`,
      [finalOrgId, inviteeUserId, roleId],
    );

    await dbClient.query(
      `INSERT INTO user_invitation (
         org_id,
         email,
         role_id,
         invitation_token,
         status,
         expires_at,
         invited_by
       ) VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
      [finalOrgId, email, roleId, invitationToken, expiresAt, inviterUserId],
    );

    await dbClient.query("COMMIT");

    return {
      success: true,
      temporaryPassword: tempPassword,
      invitationToken,
      email,
      role: requestedRole,
      userId: inviteeUserId,
      organizationId: finalOrgId,
    };
  } catch (error) {
    await dbClient.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    dbClient.release();
  }
}

export async function backfillAcceptedInvitationByEmail(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const cognitoResult = await client.send(
    new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Filter: `email = "${normalizedEmail}"`,
      Limit: 1,
    }),
  );

  const cognitoUser = cognitoResult.Users?.[0];
  const userStatus = String(cognitoUser?.UserStatus || "").toUpperCase();

  const acceptedStatuses = new Set([
    "CONFIRMED",
    "EXTERNAL_PROVIDER",
    "ARCHIVED",
    "COMPROMISED",
    "UNKNOWN",
  ]);

  if (!acceptedStatuses.has(userStatus)) {
    return false;
  }

  const updateResult = await pool.query(
    `UPDATE user_invitation
     SET status = 'accepted',
         accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)
     WHERE lower(email) = lower($1)
       AND accepted_at IS NULL`,
    [normalizedEmail],
  );

  return (updateResult.rowCount || 0) > 0;
}
