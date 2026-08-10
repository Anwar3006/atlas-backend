import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { SignJWT, importPKCS8 } from "jose";
import { db } from "../db/index.js";
import { account, session, user, verification } from "../db/schema.js";

// Apple's own maximum lifetime for a Sign In with Apple client secret JWT.
const APPLE_CLIENT_SECRET_LIFETIME_SECONDS = 15_777_000;

// better-auth's Apple provider (installed version, verified against
// node_modules/@better-auth/core/src/social-providers/apple.ts) expects a
// pre-signed JWT string as `clientSecret` -- it does not generate one for
// you. Apple requires this JWT to be signed with the ES256 private key
// downloaded from the developer console (the .p8 file).
export async function generateAppleClientSecret(params: {
  teamId: string;
  keyId: string;
  privateKey: string;
  clientId: string;
}) {
  // .p8 keys pasted into an env var often arrive with literal "\n"
  // sequences instead of real newlines; normalize either form.
  const pem = params.privateKey.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: params.keyId })
    .setIssuer(params.teamId)
    .setSubject(params.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + APPLE_CLIENT_SECRET_LIFETIME_SECONDS)
    .sign(key);
}

const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]> = {};

// Neither provider has real credentials yet (A17 -- created by hand in each
// provider's console, Epic 1 Story 5). Both activate automatically the
// moment their env vars exist in production; local/CI runs Email-only.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

if (
  process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_PRIVATE_KEY
) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: await generateAppleClientSecret({
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      clientId: process.env.APPLE_CLIENT_ID,
    }),
    appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER,
  };
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // The mobile app's custom URL scheme (app.json's "scheme": "atlas"), so
  // OAuth redirects and the Expo plugin's cross-origin cookie handling trust
  // requests coming back from the native app.
  trustedOrigins: ["atlas://"],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // A11: extends better-auth's own `user` table instead of a second
      // profile table. Only Epic 2's preferences save flips this to true --
      // never settable directly by the client (input: false).
      onboardingCompleted: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  socialProviders,
  // Required for the mobile app to hold a session at all: React Native has
  // no browser cookie jar, and this plugin changes how better-auth issues
  // sessions so @better-auth/expo's client can store/replay them itself.
  plugins: [expo()],
});
