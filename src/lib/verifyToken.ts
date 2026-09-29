import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJWKSKey = "";

function getConfig() {
  // Prefer the public (NEXT_PUBLIC_) vars: they are inlined into the build, so
  // they are present in any host's runtime (incl. Amplify, where the
  // server-only COGNITO_USER_POOL_ID is not provided). Region is derived from
  // the pool id when not set, exactly as cognito.ts does.
  const userPoolId ="ap-southeast-2_IoPPo5Onj"
  const clientId = "2imumeiva1cmesrlaoi7edpdfp"
  const region = "ap-southeast-2"
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
