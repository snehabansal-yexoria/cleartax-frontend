import {
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  type AuthenticationResultType,
  type ChallengeNameType,
  type InitiateAuthCommandOutput,
  type RespondToAuthChallengeCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserSession,
  CognitoIdToken,
  CognitoAccessToken,
  CognitoRefreshToken,
} from "amazon-cognito-identity-js";
import { userPool, cognitoIdp, clientId } from "./cognito";

// The login flow is driven directly through the AWS SDK rather than
// amazon-cognito-identity-js because that library cannot handle the EMAIL_OTP
// challenge (it has no awareness of it at any version). Once authentication
// completes we bridge the tokens back into amazon-cognito-identity-js's cache
// (see bridgeSession) so session.ts and mfa.ts keep working unchanged.

export type LoginResult =
  | { type: "SUCCESS"; idToken: string; accessToken: string }
  | { type: "EMAIL_OTP_REQUIRED"; session: string; username: string }
  | { type: "TOTP_REQUIRED"; session: string; username: string }
  | { type: "SELECT_MFA"; session: string; username: string }
  | {
    type: "NEW_PASSWORD_REQUIRED";
    session: string;
    username: string;
    userAttributes: Record<string, string>;
  };

// Populate amazon-cognito-identity-js's localStorage cache so getCurrentUser()
// / getSession() resolve to this user afterwards. setSignInUserSession calls
// cacheTokens() internally; RefreshToken must be present or silent refresh
// later breaks.
function bridgeSession(username: string, r: AuthenticationResultType) {
  const session = new CognitoUserSession({
    IdToken: new CognitoIdToken({ IdToken: r.IdToken ?? "" }),
    AccessToken: new CognitoAccessToken({ AccessToken: r.AccessToken ?? "" }),
    RefreshToken: new CognitoRefreshToken({ RefreshToken: r.RefreshToken ?? "" }),
  });

  const user = new CognitoUser({ Username: username, Pool: userPool });
  user.setSignInUserSession(session);
}

// Translate an InitiateAuth / RespondToAuthChallenge response into the typed
// step the UI handles. Challenges can chain (e.g. SELECT_MFA_TYPE -> EMAIL_OTP)
// so every responder funnels back through here.
function mapAuthResponse(
  res: InitiateAuthCommandOutput | RespondToAuthChallengeCommandOutput,
  username: string,
): LoginResult {
  if (res.AuthenticationResult) {
    bridgeSession(username, res.AuthenticationResult);
    return {
      type: "SUCCESS",
      idToken: res.AuthenticationResult.IdToken ?? "",
      accessToken: res.AuthenticationResult.AccessToken ?? "",
    };
  }

  const session = res.Session ?? "";

  switch (res.ChallengeName) {
    case "EMAIL_OTP":
      return { type: "EMAIL_OTP_REQUIRED", session, username };
    case "SOFTWARE_TOKEN_MFA":
      return { type: "TOTP_REQUIRED", session, username };
    case "SELECT_MFA_TYPE":
      return { type: "SELECT_MFA", session, username };
    case "NEW_PASSWORD_REQUIRED": {
      let userAttributes: Record<string, string> = {};
      const raw = res.ChallengeParameters?.userAttributes;
      if (raw) {
        try {
          userAttributes = JSON.parse(raw);
        } catch {
          userAttributes = {};
        }
      }
      delete userAttributes.email;
      delete userAttributes.email_verified;
      delete userAttributes.phone_number_verified;
      delete userAttributes.sub;
      return { type: "NEW_PASSWORD_REQUIRED", session, username, userAttributes };
    }
    default:
      throw new Error(
        `Unsupported sign-in challenge: ${res.ChallengeName ?? "unknown"}`,
      );
  }
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await cognitoIdp.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  );

  return mapAuthResponse(res, email);
}

async function respondToChallenge(
  challengeName: ChallengeNameType,
  session: string,
  username: string,
  responses: Record<string, string>,
): Promise<LoginResult> {
  const res = await cognitoIdp.send(
    new RespondToAuthChallengeCommand({
      ClientId: clientId,
      ChallengeName: challengeName,
      Session: session,
      ChallengeResponses: { USERNAME: username, ...responses },
    }),
  );

  return mapAuthResponse(res, username);
}

// Complete a login paused on the email-OTP challenge.
export function respondEmailOtp(
  session: string,
  username: string,
  code: string,
) {
  return respondToChallenge("EMAIL_OTP", session, username, {
    EMAIL_OTP_CODE: code,
  });
}

// Complete a login paused on the TOTP (authenticator app) challenge.
export function respondTotp(session: string, username: string, code: string) {
  return respondToChallenge("SOFTWARE_TOKEN_MFA", session, username, {
    SOFTWARE_TOKEN_MFA_CODE: code,
  });
}

// Answer a SELECT_MFA_TYPE challenge (a user with both email + TOTP enabled);
// returns the follow-on EMAIL_OTP / SOFTWARE_TOKEN_MFA challenge.
export function selectMfa(
  session: string,
  username: string,
  answer: "EMAIL_OTP" | "SOFTWARE_TOKEN_MFA",
) {
  return respondToChallenge("SELECT_MFA_TYPE", session, username, {
    ANSWER: answer,
  });
}

export async function completeNewPassword(
  session: string,
  username: string,
  newPassword: string,
  attributes: Record<string, string>,
): Promise<{ idToken: string }> {
  const responses: Record<string, string> = { NEW_PASSWORD: newPassword };
  for (const [name, value] of Object.entries(attributes)) {
    responses[`userAttributes.${name}`] = value;
  }

  const res = await cognitoIdp.send(
    new RespondToAuthChallengeCommand({
      ClientId: clientId,
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: session,
      ChallengeResponses: { USERNAME: username, ...responses },
    }),
  );

  // The existing UX asks the user to log in again afterwards, so we only need
  // the id token (if any) for the best-effort invitation acceptance.
  return { idToken: res.AuthenticationResult?.IdToken ?? "" };
}

export function signUp(params: {
  email: string;
  password: string;
  fullName: string;
  role: string;
  tenantCode?: string;
}) {
  const attributes = [
    new CognitoUserAttribute({
      Name: "email",
      Value: params.email,
    }),
    new CognitoUserAttribute({
      Name: "name",
      Value: params.fullName,
    }),
    new CognitoUserAttribute({
      Name: "custom:role",
      Value: params.role,
    }),
  ];

  const tenantCode = String(params.tenantCode || "").trim().toUpperCase();

  if (tenantCode) {
    attributes.push(
      new CognitoUserAttribute({
        Name: "custom:tenant_code",
        Value: tenantCode,
      }),
    );
  }

  return new Promise((resolve, reject) => {
    userPool.signUp(params.email, params.password, attributes, [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(result);
    });
  });
}