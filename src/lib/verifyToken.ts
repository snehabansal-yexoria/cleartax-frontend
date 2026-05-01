import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJWKSKey = "";

function getConfig() {
  const region = process.env.APP_REGION || process.env.AWS_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!region || !userPoolId || !clientId) {
    throw new Error(
      `verifyToken misconfigured: APP_REGION=${region ? "set" : "MISSING"} ` +
        `COGNITO_USER_POOL_ID=${userPoolId ? "set" : "MISSING"} ` +
        `NEXT_PUBLIC_COGNITO_CLIENT_ID=${clientId ? "set" : "MISSING"}`,
    );
  }
  return { region, userPoolId, clientId };
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { region, userPoolId, clientId } = getConfig();
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    const cacheKey = `${region}|${userPoolId}`;
    if (!cachedJWKS || cachedJWKSKey !== cacheKey) {
      cachedJWKS = createRemoteJWKSet(
        new URL(`${issuer}/.well-known/jwks.json`),
      );
      cachedJWKSKey = cacheKey;
    }
    const { payload } = await jwtVerify(token, cachedJWKS, {
      issuer,
      audience: clientId,
    });
    return payload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
