import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";
import { styleAssets, styleSettings } from "./hosted-pages-style.ts";

export interface Login {
  readonly issuer: string;
  readonly clientId: string;
  readonly domain: string;
}

export const GOOGLE_SECRET = "polygossa/google-oauth";

const BRAND = process.env.BRAND_NAME?.trim() || "Polygossa";

export function userPool(
  scope: Construct,
  opts: { domainPrefix: string; siteUrl: string; previousSiteUrls?: string[]; keep: boolean; googleClientId: string },
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
  const siteUrls = [opts.siteUrl, ...(opts.previousSiteUrls ?? [])];
  const client = pool.addClient("Site", {
    generateSecret: false,
    authFlows: { userSrp: true },
    oAuth: {
      flows: { authorizationCodeGrant: true },
      scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.COGNITO_ADMIN],
      callbackUrls: siteUrls.map((url) => `${url}/api/auth/callback`),
      logoutUrls: siteUrls.map((url) => `${url}/`),
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
  new cognito.CfnManagedLoginBranding(scope, "HostedPagesStyle", {
    userPoolId: pool.userPoolId,
    clientId: client.userPoolClientId,
    useCognitoProvidedValues: false,
    settings: styleSettings(),
    assets: styleAssets(BRAND),
  });
  return {
    issuer: pool.userPoolProviderUrl,
    clientId: client.userPoolClientId,
    domain: `https://${domain.domainName}.auth.${cdk.Stack.of(scope).region}.amazoncognito.com`,
  };
}
