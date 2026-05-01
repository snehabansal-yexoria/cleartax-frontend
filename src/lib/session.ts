import type { CognitoUserSession } from "amazon-cognito-identity-js";
import { userPool } from "./cognito";

export function getCurrentUser() {
  return userPool.getCurrentUser();
}

export function getSession() {
  return new Promise<CognitoUserSession | null>((resolve, reject) => {
    const user = userPool.getCurrentUser();

    if (!user) {
      resolve(null);
      return;
    }

    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(session);
    });
  });
}
