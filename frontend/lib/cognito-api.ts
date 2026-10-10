import type { CognitoConfig } from "./cognito";

function regionOf(config: CognitoConfig): string {
  return /\.auth\.([a-z0-9-]+)\.amazoncognito\.com/.exec(config.domain)?.[1] ?? "eu-west-1";
}

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

export async function globalSignOut(config: CognitoConfig, access: string): Promise<boolean> {
  return (await call(config, "GlobalSignOut", { AccessToken: access })) !== null;
}

export async function deleteCognitoUser(config: CognitoConfig, access: string): Promise<boolean> {
  return (await call(config, "DeleteUser", { AccessToken: access })) !== null;
}

export interface MfaStatus {
  on: boolean;
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

export async function startTotp(config: CognitoConfig, access: string, email: string, brand: string) {
  const answer = await call(config, "AssociateSoftwareToken", { AccessToken: access });
  const secret = typeof answer?.SecretCode === "string" ? answer.SecretCode : null;
  if (!secret) return null;
  const label = `${encodeURIComponent(brand)}:${encodeURIComponent(email)}`;
  return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(brand)}` };
}

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
