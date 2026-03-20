import { jwtVerify, createRemoteJWKSet } from "jose";

const region = process.env.AWS_REGION;
const userPoolId = process.env.COGNITO_USER_POOL_ID;

const JWKS = createRemoteJWKSet(
  new URL(
    `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
  ),
);

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    });

    return payload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
