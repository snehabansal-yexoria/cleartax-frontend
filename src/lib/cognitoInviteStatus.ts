import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

function escapeCognitoFilterValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function mapCognitoStatusToInviteStatus(
  status?: string,
  enabled?: boolean,
) {
  if (enabled === false) {
    return "INACTIVE";
  }

  const normalized = String(status || "").trim().toUpperCase();

  if (
    ["FORCE_CHANGE_PASSWORD", "RESET_REQUIRED", "UNCONFIRMED"].includes(
      normalized,
    )
  ) {
    return "PENDING";
  }

  if (["CONFIRMED", "EXTERNAL_PROVIDER"].includes(normalized)) {
    return "ACTIVE";
  }

  return "";
}

export function normalizeInviteStatus(status: string, cognitoStatus = "") {
  const preferred = String(cognitoStatus || "").trim().toUpperCase();

  if (preferred) {
    return preferred;
  }

  const normalized = String(status || "").trim().toUpperCase();

  if (
    ["PENDING", "INVITED", "FORCE_CHANGE_PASSWORD", "RESET_REQUIRED"].includes(
      normalized,
    )
  ) {
    return "PENDING";
  }

  if (["ACCEPTED", "ACTIVE", "CONFIRMED"].includes(normalized)) {
    return "ACTIVE";
  }

  if (normalized === "INACTIVE") {
    return "PENDING";
  }

  return normalized || "PENDING";
}

export async function getCognitoInviteStatusByEmail(email: string) {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!userPoolId || !normalizedEmail) {
    return "";
  }

  try {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${escapeCognitoFilterValue(normalizedEmail)}"`,
        Limit: 1,
      }),
    );

    const user = response.Users?.[0];
    return mapCognitoStatusToInviteStatus(user?.UserStatus, user?.Enabled);
  } catch (error) {
    console.error("Failed to fetch Cognito invite status:", error);
    return "";
  }
}
