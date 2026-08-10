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
  const pem = params.privateKey.replaceAll(String.raw`\n`, "\n");
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

// Neither provider has real credentials yet (A17 -- created by hand in each
// provider's console, Epic 1 Story 5). Both activate automatically the
// moment their env vars exist in production; local/CI runs Email-only.
// Takes `env` as a parameter (rather than reading `process.env` directly) so
// both branches are exercised by a plain unit test instead of needing
// module-cache tricks to re-import with different env vars set.
export async function buildSocialProviders(env: NodeJS.ProcessEnv) {
  // Inferred, not annotated with betterAuth()'s own (wider) socialProviders
  // type: that type also allows each provider to be a lazy factory function
  // (`AwaitableFunction<T> = T | (() => Awaitable<T>)`), which we never use
  // -- an explicit plain-object type here keeps the return value's shape
  // concrete for callers (like this file's tests) instead of a factory-or-
  // object union they'd have to narrow first.
  const socialProviders: {
    google?: { clientId: string; clientSecret: string };
    apple?: {
      clientId: string;
      clientSecret: string;
      appBundleIdentifier: string | undefined;
    };
  } = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: await generateAppleClientSecret({
        teamId: env.APPLE_TEAM_ID,
        keyId: env.APPLE_KEY_ID,
        privateKey: env.APPLE_PRIVATE_KEY,
        clientId: env.APPLE_CLIENT_ID,
      }),
      appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
    };
  }

  return socialProviders;
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
  socialProviders: await buildSocialProviders(process.env),
  // Required for the mobile app to hold a session at all: React Native has
  // no browser cookie jar, and this plugin changes how better-auth issues
  // sessions so @better-auth/expo's client can store/replay them itself.
  plugins: [expo()],
});
