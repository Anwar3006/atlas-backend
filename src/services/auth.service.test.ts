import { describe, expect, it } from "vitest";
import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { apple } from "better-auth/social-providers";
import { buildSocialProviders, generateAppleClientSecret } from "./auth.service.js";

function fakeAppleIdToken(payload: Record<string, unknown>) {
  const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  // getUserInfo only decodes this (jose's decodeJwt), never verifies the
  // signature -- a real Apple id_token is always signed, but a fake
  // signature segment is enough to exercise that code path here.
  return `${base64url({ alg: "ES256" })}.${base64url(payload)}.fake-signature`;
}

describe("generateAppleClientSecret", () => {
  it("produces a JWT Apple's own /auth/token endpoint would accept as a client secret", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const pem = await exportPKCS8(privateKey);

    const jwt = await generateAppleClientSecret({
      teamId: "TEAMID1234",
      keyId: "KEYID5678",
      privateKey: pem,
      clientId: "com.atlas.app.service",
    });

    const { payload, protectedHeader } = await jwtVerify(jwt, publicKey, {
      issuer: "TEAMID1234",
      subject: "com.atlas.app.service",
      audience: "https://appleid.apple.com",
    });

    expect(protectedHeader.alg).toBe("ES256");
    expect(protectedHeader.kid).toBe("KEYID5678");
    expect(payload.exp).toBeGreaterThan(payload.iat!);
  });

  it("also accepts a private key with literal \\n sequences instead of real newlines", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const pem = (await exportPKCS8(privateKey)).replace(/\n/g, "\\n");

    const jwt = await generateAppleClientSecret({
      teamId: "TEAMID1234",
      keyId: "KEYID5678",
      privateKey: pem,
      clientId: "com.atlas.app.service",
    });

    await expect(jwtVerify(jwt, publicKey, { issuer: "TEAMID1234" })).resolves.toBeDefined();
  });
});

describe("buildSocialProviders", () => {
  it("enables neither provider when no env vars are set", async () => {
    expect(await buildSocialProviders({})).toEqual({});
  });

  it("enables google once both its env vars are present", async () => {
    const result = await buildSocialProviders({
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    });

    expect(result.google).toEqual({ clientId: "google-client-id", clientSecret: "google-client-secret" });
    expect(result.apple).toBeUndefined();
  });

  it("leaves google disabled if only one of its two env vars is set", async () => {
    expect(await buildSocialProviders({ GOOGLE_CLIENT_ID: "google-client-id" })).toEqual({});
  });

  it("enables apple once all four of its env vars are present", async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    const pem = await exportPKCS8(privateKey);

    const result = await buildSocialProviders({
      APPLE_CLIENT_ID: "com.atlas.app.service",
      APPLE_TEAM_ID: "TEAMID1234",
      APPLE_KEY_ID: "KEYID5678",
      APPLE_PRIVATE_KEY: pem,
      APPLE_APP_BUNDLE_IDENTIFIER: "com.atlas.app",
    });

    expect(result.apple?.clientId).toBe("com.atlas.app.service");
    expect(result.apple?.appBundleIdentifier).toBe("com.atlas.app");
    expect(typeof result.apple?.clientSecret).toBe("string");
    expect(result.google).toBeUndefined();
  });

  it("leaves apple disabled if any one of its four env vars is missing", async () => {
    const result = await buildSocialProviders({
      APPLE_CLIENT_ID: "com.atlas.app.service",
      APPLE_TEAM_ID: "TEAMID1234",
      APPLE_KEY_ID: "KEYID5678",
      // APPLE_PRIVATE_KEY intentionally omitted
    });

    expect(result).toEqual({});
  });
});

// Characterizes the *installed* better-auth Apple provider's own behavior
// (node_modules/@better-auth/core/src/social-providers/apple.ts), not code
// we wrote: Apple only ever sends the user's name once, in a non-standard
// `user` JSON param on the very first authorization -- every later sign-in
// omits it entirely. This locks in that our config relies on real,
// version-verified behavior rather than assumptions, and would fail loudly
// if a future better-auth upgrade changes it.
describe("apple provider getUserInfo (first-login data capture)", () => {
  const provider = apple({ clientId: "com.atlas.app.service", clientSecret: "unused-in-getUserInfo" });

  it("captures the one-time name and the email on first authorization", async () => {
    const idToken = fakeAppleIdToken({ sub: "apple-user-1", email: "person@example.com", email_verified: "true" });

    const result = await provider.getUserInfo({
      idToken,
      user: { name: { firstName: "Ada", lastName: "Lovelace" } },
    });

    expect(result?.user.name).toBe("Ada Lovelace");
    expect(result?.user.email).toBe("person@example.com");
    expect(result?.user.emailVerified).toBe(true);
  });

  it("still returns a stable email on a later sign-in, with no name to lose", async () => {
    const idToken = fakeAppleIdToken({ sub: "apple-user-1", email: "person@example.com", email_verified: "true" });

    const result = await provider.getUserInfo({ idToken });

    expect(result?.user.email).toBe("person@example.com");
    expect(result?.user.name).toBe("");
  });
});
