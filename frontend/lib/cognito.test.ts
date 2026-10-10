import { afterEach, describe, expect, it, vi } from "vitest";
import {
  challengeFor,
  cognitoConfig,
  decodePending,
  encodePending,
  exchangeCode,
  expiresAt,
  logoutUrl,
  needsRenewal,
  renew,
  safeNext,
  startLogin,
} from "./cognito";
import { confirmTotp, deleteCognitoUser, globalSignOut, mfaStatus, startTotp, turnOffTotp } from "./cognito-api";

const config = { domain: "https://polygossa.auth.eu-west-1.amazoncognito.com", clientId: "abc", appUrl: "https://site" };

function jwt(payload: object): string {
  const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${part({ alg: "RS256" })}.${part(payload)}.sig`;
}

afterEach(() => vi.unstubAllGlobals());

describe("cognitoConfig", () => {
  it("is off without a domain or client", () => {
    expect(cognitoConfig({})).toBeNull();
    expect(cognitoConfig({ COGNITO_DOMAIN: "https://d" })).toBeNull();
    expect(cognitoConfig({ COGNITO_CLIENT_ID: "abc" })).toBeNull();
  });

  it("reads the settings, trimming trailing slashes, with localhost as the default site", () => {
    expect(cognitoConfig({ COGNITO_DOMAIN: "https://d/", COGNITO_CLIENT_ID: "abc" }))
      .toEqual({ domain: "https://d", clientId: "abc", appUrl: "http://localhost:3000" });
    expect(cognitoConfig({ COGNITO_DOMAIN: "https://d", COGNITO_CLIENT_ID: "abc", APP_URL: "https://site/" })?.appUrl)
      .toBe("https://site");
  });
});

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/review?x=1")).toBe("/review?x=1");
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "review"])(
    "sends %s to Explore instead",
    (next) => expect(safeNext(next)).toBe("/community"),
  );
});

describe("startLogin", () => {
  it("sends sign-in to the authorize page with PKCE, our client and our return address", async () => {
    const { pending, url } = await startLogin(config, "login", "/review");
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${config.domain}/oauth2/authorize`);
    expect(Object.fromEntries(u.searchParams)).toEqual({
      response_type: "code",
      client_id: "abc",
      redirect_uri: "https://site/api/auth/callback",
      scope: "openid email aws.cognito.signin.user.admin",
      state: pending.state,
      code_challenge: await challengeFor(pending.verifier),
      code_challenge_method: "S256",
    });
    expect(pending.next).toBe("/review");
    expect(pending.state).not.toBe(pending.verifier);
  });

  it("sends sign-up to the sign-up page, and a foreign return address to Explore", async () => {
    const { pending, url } = await startLogin(config, "signup", "https://evil.example");
    expect(new URL(url).pathname).toBe("/signup");
    expect(pending.next).toBe("/community");
  });

  it("makes a new state every time", async () => {
    const a = await startLogin(config, "login", null);
    const b = await startLogin(config, "login", null);
    expect(a.pending.state).not.toBe(b.pending.state);
  });
});

describe("challengeFor", () => {
  it("is the RFC 7636 S256 challenge", async () => {
    expect(await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
      .toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("pending sign-in cookie", () => {
  it("round-trips, and anything malformed is no sign-in", () => {
    const pending = { state: "s", verifier: "v", next: "/x" };
    expect(decodePending(encodePending(pending))).toEqual(pending);
    expect(decodePending(undefined)).toBeNull();
    expect(decodePending("not json")).toBeNull();
    expect(decodePending(JSON.stringify({ state: "s" }))).toBeNull();
    expect(decodePending(JSON.stringify({ state: "s", verifier: "v", next: "//evil" }))?.next).toBe("/community");
  });
});

describe("token requests", () => {
  it("trades a code for tokens with the verifier", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ access_token: "a", id_token: "i", refresh_token: "r", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await exchangeCode(config, "code-1", "verifier-1")).toEqual({ access: "a", id: "i", refresh: "r" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${config.domain}/oauth2/token`);
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      client_id: "abc",
      grant_type: "authorization_code",
      code: "code-1",
      redirect_uri: "https://site/api/auth/callback",
      code_verifier: "verifier-1",
    });
  });

  it("is null when Cognito refuses or can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "invalid_grant" }, { status: 400 })));
    expect(await exchangeCode(config, "c", "v")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await renew(config, "r")).toBeNull();
  });

  it("keeps the refresh token when renewing returns none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access_token: "a2", id_token: "i2" })));
    expect(await renew(config, "r1")).toEqual({ access: "a2", id: "i2", refresh: "r1" });
  });
});

describe("renewal", () => {
  it("reads a token's expiry", () => {
    expect(expiresAt(jwt({ exp: 1000 }))).toBe(1000);
    expect(expiresAt("garbage")).toBeNull();
  });

  it("renews a missing, unreadable or nearly expired token, not a fresh one", () => {
    expect(needsRenewal(undefined, 0)).toBe(true);
    expect(needsRenewal("garbage", 0)).toBe(true);
    expect(needsRenewal(jwt({ exp: 1030 }), 1000)).toBe(true);
    expect(needsRenewal(jwt({ exp: 1060 }), 1000)).toBe(false);
  });
});

describe("globalSignOut", () => {
  it("asks Cognito's API in the pool's region to end every session of the token's user", async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    expect(await globalSignOut(config, "access-1")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://cognito-idp.eu-west-1.amazonaws.com/");
    expect(new Headers(init.headers).get("x-amz-target")).toBe("AWSCognitoIdentityProviderService.GlobalSignOut");
    expect(new Headers(init.headers).get("content-type")).toBe("application/x-amz-json-1.1");
    expect(JSON.parse(init.body as string)).toEqual({ AccessToken: "access-1" });
  });

  it("reports a refusal or an unreachable Cognito", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ __type: "NotAuthorizedException" }, { status: 400 })));
    expect(await globalSignOut(config, "a")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await globalSignOut(config, "a")).toBe(false);
  });
});

describe("authenticator-app MFA", () => {
  const calls = (mock: ReturnType<typeof vi.fn>) =>
    (mock.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => ({
      target: new Headers(init.headers).get("x-amz-target")?.replace("AWSCognitoIdentityProviderService.", ""),
      body: JSON.parse(init.body as string) as Record<string, unknown>,
    }));

  it("reads whether it is on, and whether the account signs in with Google instead", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ Username: "abc", UserMFASettingList: ["SOFTWARE_TOKEN_MFA"] })));
    expect(await mfaStatus(config, "a")).toEqual({ on: true, federated: false });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ Username: "google_123" })));
    expect(await mfaStatus(config, "a")).toEqual({ on: false, federated: true });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 400 })));
    expect(await mfaStatus(config, "a")).toBeNull();
  });

  it("starts with a secret for the authenticator app and a link that opens it", async () => {
    const fetchMock = vi.fn(async () => Response.json({ SecretCode: "ABCDEF234567" }));
    vi.stubGlobal("fetch", fetchMock);
    const setup = await startTotp(config, "a", "ana@example.com", "Polygossa");
    expect(setup).toEqual({
      secret: "ABCDEF234567",
      uri: "otpauth://totp/Polygossa:ana%40example.com?secret=ABCDEF234567&issuer=Polygossa",
    });
    expect(calls(fetchMock)).toEqual([{ target: "AssociateSoftwareToken", body: { AccessToken: "a" } }]);
  });

  it("turns on only after a correct code from the app, and makes it the preferred second step", async () => {
    const fetchMock = vi.fn(async () => Response.json({ Status: "SUCCESS" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await confirmTotp(config, "a", "123456")).toBe(true);
    expect(calls(fetchMock)).toEqual([
      { target: "VerifySoftwareToken", body: { AccessToken: "a", UserCode: "123456", FriendlyDeviceName: "Authenticator app" } },
      { target: "SetUserMFAPreference", body: { AccessToken: "a", SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true } } },
    ]);

    const wrong = vi.fn(async () => Response.json({ __type: "EnableSoftwareTokenMFAException" }, { status: 400 }));
    vi.stubGlobal("fetch", wrong);
    expect(await confirmTotp(config, "a", "000000")).toBe(false);
    expect(calls(wrong)).toHaveLength(1);
  });

  it("turns off", async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    expect(await turnOffTotp(config, "a")).toBe(true);
    expect(calls(fetchMock)).toEqual([
      { target: "SetUserMFAPreference", body: { AccessToken: "a", SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false } } },
    ]);
  });
});

describe("deleteCognitoUser", () => {
  it("deletes the token's own user from the pool", async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    expect(await deleteCognitoUser(config, "access-1")).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("x-amz-target")).toBe("AWSCognitoIdentityProviderService.DeleteUser");
    expect(JSON.parse(init.body as string)).toEqual({ AccessToken: "access-1" });
  });

  it("reports a refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 400 })));
    expect(await deleteCognitoUser(config, "a")).toBe(false);
  });
});

describe("logoutUrl", () => {
  it("passes through Cognito's sign-out back to the landing page", () => {
    const u = new URL(logoutUrl(config));
    expect(u.pathname).toBe("/logout");
    expect(u.searchParams.get("client_id")).toBe("abc");
    expect(u.searchParams.get("logout_uri")).toBe("https://site/");
  });
});
