import { CognitoUserPool } from "amazon-cognito-identity-js";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;
export const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;

// Pool ids look like "ap-southeast-2_abc123"; the region is the prefix, so we
// can derive it without introducing another env var.
export const region = userPoolId.split("_")[0];

export const userPool = new CognitoUserPool({
  UserPoolId: userPoolId,
  ClientId: clientId,
});

// Unauthenticated/public Cognito APIs (InitiateAuth, RespondToAuthChallenge,
// GetUser, SetUserMFAPreference) are called directly via the SDK so we can
// handle EMAIL_OTP, which amazon-cognito-identity-js does not support.
export const cognitoIdp = new CognitoIdentityProviderClient({ region });
