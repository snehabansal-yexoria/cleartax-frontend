import { CognitoUser } from "amazon-cognito-identity-js";
import { userPool } from "./cognito";

// Cognito's TOTP factor is identified by this string everywhere in the API.
const SOFTWARE_TOKEN_MFA = "SOFTWARE_TOKEN_MFA";

export interface MfaStatus {
  enabled: boolean;
  preferred: boolean;
}

// Resolve the current user with a live session attached. All the MFA calls
// below need a valid access token, which getSession() refreshes onto the user.
export function getAuthenticatedUser(): Promise<CognitoUser> {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser();

    if (!user) {
      reject(new Error("Your session has expired. Please log in again."));
      return;
    }

    user.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(user);
    });
  });
}

// Read whether the user has TOTP registered/preferred. bypassCache forces a
// fresh read so the UI reflects an enable/disable that just happened.
export function getMfaStatus(user: CognitoUser): Promise<MfaStatus> {
  return new Promise((resolve, reject) => {
    user.getUserData(
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const list = data?.UserMFASettingList ?? [];

        resolve({
          enabled: list.includes(SOFTWARE_TOKEN_MFA),
          preferred: data?.PreferredMfaSetting === SOFTWARE_TOKEN_MFA,
        });
      },
      { bypassCache: true },
    );
  });
}

// Step 1 of enrollment: ask Cognito for a fresh TOTP secret to show as a QR.
export function associateTotp(user: CognitoUser): Promise<string> {
  return new Promise((resolve, reject) => {
    user.associateSoftwareToken({
      associateSecretCode: (secret: string) => resolve(secret),
      onFailure: (err) => reject(err),
    });
  });
}

// Step 2 of enrollment: verify the first code, then mark TOTP as the
// preferred MFA so future logins are challenged.
export function verifyAndEnableTotp(
  user: CognitoUser,
  code: string,
  deviceName = "Authenticator",
): Promise<void> {
  return new Promise((resolve, reject) => {
    user.verifySoftwareToken(code, deviceName, {
      onSuccess: () => {
        user.setUserMfaPreference(
          null,
          { PreferredMfa: true, Enabled: true },
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve();
          },
        );
      },
      onFailure: (err) => reject(err),
    });
  });
}

export function disableTotp(user: CognitoUser): Promise<void> {
  return new Promise((resolve, reject) => {
    user.setUserMfaPreference(
      null,
      { PreferredMfa: false, Enabled: false },
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      },
    );
  });
}

// The otpauth:// URI an authenticator app expects when it scans the QR code.
export function buildOtpAuthUri(
  secret: string,
  email: string,
  issuer = "Clear Portfolio",
): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({ secret, issuer });
  return `otpauth://totp/${label}?${params.toString()}`;
}
