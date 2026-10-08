import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

export interface Login {
  /** The issuer the backend checks tokens against (https://cognito-idp.<region>.amazonaws.com/<pool id>). */
  readonly issuer: string;
  readonly clientId: string;
  /** The hosted pages' address, e.g. https://polygossa.auth.eu-west-1.amazoncognito.com. */
  readonly domain: string;
}

/**
 * A Cognito user pool with its hosted sign-in pages and one app client for the site at `siteUrl`
 * (docs/acceptance/cognito-login.feature). People sign up with their email, which Cognito verifies; MFA by
 * authenticator app is optional. The client has no secret: the frontend's server runs the code flow with PKCE and
 * keeps the tokens, so the browser never sees them.
 */
/**
 * Sign in with Google: the OAuth client in the owner's Google account. Its secret is kept in Secrets Manager
 * (`polygossa/google-oauth`, made by the owner, JSON with clientSecret) and read by CloudFormation at deploy, so it
 * never appears in the code or the template.
 */
export const GOOGLE_SECRET = "polygossa/google-oauth";

export function userPool(
  scope: Construct,
  opts: { domainPrefix: string; siteUrl: string; keep: boolean; googleClientId: string },
): Login {
  const pool = new cognito.UserPool(scope, "Users", {
    featurePlan: cognito.FeaturePlan.ESSENTIALS,
    selfSignUpEnabled: true,
    signInAliases: { email: true },
    autoVerify: { email: true },
    standardAttributes: { email: { required: true, mutable: true } },
    passwordPolicy: {
      minLength: 8,
      requireLowercase: true,
      requireUppercase: true,
      requireDigits: true,
      requireSymbols: false,
    },
    accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    mfa: cognito.Mfa.OPTIONAL,
    mfaSecondFactor: { otp: true, sms: false },
    removalPolicy: opts.keep ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  });
  const domain = pool.addDomain("HostedPages", {
    cognitoDomain: { domainPrefix: opts.domainPrefix },
    managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
  });
  // A Google sign-in becomes its own Cognito identity; the backend links it to the account with the same verified
  // email, so signing in with Google or a password reaches the same account.
  const google = new cognito.UserPoolIdentityProviderGoogle(scope, "Google", {
    userPool: pool,
    clientId: opts.googleClientId,
    clientSecretValue: cdk.SecretValue.secretsManager(GOOGLE_SECRET, { jsonField: "clientSecret" }),
    scopes: ["openid", "email", "profile"],
    attributeMapping: {
      email: cognito.ProviderAttribute.GOOGLE_EMAIL,
      emailVerified: cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
    },
  });
  const client = pool.addClient("Site", {
    generateSecret: false,
    authFlows: { userSrp: true },
    oAuth: {
      flows: { authorizationCodeGrant: true },
      scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
      callbackUrls: [`${opts.siteUrl}/api/auth/callback`],
      logoutUrls: [`${opts.siteUrl}/`],
    },
    supportedIdentityProviders: [
      cognito.UserPoolClientIdentityProvider.COGNITO,
      cognito.UserPoolClientIdentityProvider.GOOGLE,
    ],
    preventUserExistenceErrors: true,
    enableTokenRevocation: true,
    accessTokenValidity: cdk.Duration.hours(1),
    idTokenValidity: cdk.Duration.hours(1),
    refreshTokenValidity: cdk.Duration.days(30),
  });
  client.node.addDependency(google);
  // The newer hosted pages need a style; Cognito's own look until ours is designed.
  new cognito.CfnManagedLoginBranding(scope, "HostedPagesStyle", {
    userPoolId: pool.userPoolId,
    clientId: client.userPoolClientId,
    useCognitoProvidedValues: true,
  });
  return {
    issuer: pool.userPoolProviderUrl,
    clientId: client.userPoolClientId,
    domain: `https://${domain.domainName}.auth.${cdk.Stack.of(scope).region}.amazoncognito.com`,
  };
}
