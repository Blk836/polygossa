import type { CognitoConfig } from "./cognito";

/**
 * Cognito's own API for the signed-in user (docs/acceptance/cognito-login.feature): signing out everywhere and the
 * authenticator-app second step. Each call is authorized by the session's access token (it carries the
 * aws.cognito.signin.user.admin scope), so no AWS keys are involved. Called only by the frontend's server.
 */

/** The pool's region, from its hosted pages' address (<prefix>.auth.<region>.amazoncognito.com). */
function regionOf(config: CognitoConfig): string {
  return /\.auth\.([a-z0-9-]+)\.amazoncognito\.com/.exec(config.domain)?.[1] ?? "eu-west-1";
}

/** One API call; the answer's JSON, or null when Cognito refuses or can't be reached. */
async function call(config: CognitoConfig, action: string, body: object): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://cognito-idp.${regionOf(config)}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Ends every Cognito session of the token's user: all their refresh tokens stop working. */
export async function globalSignOut(config: CognitoConfig, access: string): Promise<boolean> {
  return (await call(config, "GlobalSignOut", { AccessToken: access })) !== null;
}

export interface MfaStatus {
  on: boolean;
  /** Signs in with Google, whose own two-step verification applies instead. */
  federated: boolean;
}

export async function mfaStatus(config: CognitoConfig, access: string): Promise<MfaStatus | null> {
  const user = await call(config, "GetUser", { AccessToken: access });
  if (!user) return null;
  const list = Array.isArray(user.UserMFASettingList) ? user.UserMFASettingList : [];
  return {
    on: list.includes("SOFTWARE_TOKEN_MFA"),
    federated: typeof user.Username === "string" && user.Username.startsWith("google_"),
  };
}

/** A new secret for the authenticator app, and the otpauth: link that adds it to the app on a phone. */
export async function startTotp(config: CognitoConfig, access: string, email: string, brand: string) {
  const answer = await call(config, "AssociateSoftwareToken", { AccessToken: access });
  const secret = typeof answer?.SecretCode === "string" ? answer.SecretCode : null;
  if (!secret) return null;
  const label = `${encodeURIComponent(brand)}:${encodeURIComponent(email)}`;
  return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(brand)}` };
}

/** Turns the second step on once the app's code proves it was set up; false for a wrong code. */
export async function confirmTotp(config: CognitoConfig, access: string, code: string): Promise<boolean> {
  const verified = await call(config, "VerifySoftwareToken", {
    AccessToken: access,
    UserCode: code,
    FriendlyDeviceName: "Authenticator app",
  });
  if (verified?.Status !== "SUCCESS") return false;
  return (await call(config, "SetUserMFAPreference", {
    AccessToken: access,
    SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
  })) !== null;
}

export async function turnOffTotp(config: CognitoConfig, access: string): Promise<boolean> {
  return (await call(config, "SetUserMFAPreference", {
    AccessToken: access,
    SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
  })) !== null;
}
