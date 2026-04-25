import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
} from "amazon-cognito-identity-js";
import { userPool } from "./cognito";

export function login(email: string, password: string) {
  const user = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  const authDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (result) => {
        const idToken = result.getIdToken().getJwtToken();
        const accessToken = result.getAccessToken().getJwtToken();

        resolve({
          type: "SUCCESS",
          idToken,
          accessToken,
          result,
        });
      },

      onFailure: (err) => {
        console.error("Cognito login error:", err);
        reject(err);
      },

      newPasswordRequired: (userAttributes) => {
        delete userAttributes.email;
        delete userAttributes.email_verified;
        delete userAttributes.phone_number_verified;
        delete userAttributes.sub;

        resolve({
          type: "NEW_PASSWORD_REQUIRED",
          user,
          userAttributes,
        });
      },
    });
  });
}

export function completeNewPassword(
  user: CognitoUser,
  newPassword: string,
  attributes: Record<string, string>,
) {
  return new Promise((resolve, reject) => {
    user.completeNewPasswordChallenge(newPassword, attributes, {
      onSuccess: (result) => resolve(result),
      onFailure: (err) => reject(err),
    });
  });
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
