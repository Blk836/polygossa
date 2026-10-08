// docs/acceptance/cognito-login.feature, "The user pools are defined in CDK".
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { defineApp } from "../lib/app.ts";

const SITE = "https://site.example";
const GOOGLE_CLIENT = "google-client.apps.googleusercontent.com";
let production: Template;
let qa: Template;

before(() => {
  const app = new cdk.App({
    context: { "github-repo": "owner/repo", "github-subject": "repo:owner/repo", "site-url": SITE,
      "google-client-id": GOOGLE_CLIENT },
  });
  const stacks = defineApp(app, { account: "111111111111", region: "eu-west-1" }, "pl-cloudfront");
  production = Template.fromStack(stacks.production);
  qa = Template.fromStack(stacks.qa);
});

/** The container definition called `name` in `template`. */
function container(template: Template, name: string): Record<string, unknown> {
  for (const task of Object.values(template.findResources("AWS::ECS::TaskDefinition"))) {
    const found = (task.Properties.ContainerDefinitions as Record<string, unknown>[]).find((c) => c.Name === name);
    if (found) return found;
  }
  throw new Error(`no container ${name}`);
}

const envNames = (c: Record<string, unknown>) => (c.Environment as { Name: string }[]).map((e) => e.Name);
const envValue = (c: Record<string, unknown>, name: string) =>
  (c.Environment as { Name: string; Value: unknown }[]).find((e) => e.Name === name)?.Value;

for (const [label, template, home] of [
  ["production", () => production, SITE],
  ["QA", () => qa, "http://localhost:3000"],
] as const) {
  describe(`${label} user pool`, () => {
    it("signs people up with a verified email, a strong password, email recovery and optional app MFA", () => {
      template().resourceCountIs("AWS::Cognito::UserPool", 1);
      template().hasResourceProperties("AWS::Cognito::UserPool", {
        UsernameAttributes: ["email"],
        AutoVerifiedAttributes: ["email"],
        AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
        Policies: { PasswordPolicy: Match.objectLike({
          MinimumLength: 8, RequireLowercase: true, RequireUppercase: true, RequireNumbers: true,
        }) },
        AccountRecoverySetting: { RecoveryMechanisms: [{ Name: "verified_email", Priority: 1 }] },
        MfaConfiguration: "OPTIONAL",
        EnabledMfas: ["SOFTWARE_TOKEN_MFA"],
      });
    });

    it("has Cognito's hosted pages on its own Cognito address", () => {
      template().hasResourceProperties("AWS::Cognito::UserPoolDomain", {
        Domain: label === "production" ? "polygossa" : "polygossa-qa",
        ManagedLoginVersion: 2,
      });
      template().resourceCountIs("AWS::Cognito::ManagedLoginBranding", 1);
    });

    it("has one app client, without a secret, using the code flow and returning only to its own site", () => {
      template().resourceCountIs("AWS::Cognito::UserPoolClient", 1);
      template().hasResourceProperties("AWS::Cognito::UserPoolClient", {
        GenerateSecret: false,
        AllowedOAuthFlows: ["code"],
        AllowedOAuthFlowsUserPoolClient: true,
        AllowedOAuthScopes: Match.arrayEquals(["openid", "email", "aws.cognito.signin.user.admin"]),
        CallbackURLs: [`${home}/api/auth/callback`],
        LogoutURLs: [`${home}/`],
        SupportedIdentityProviders: Match.arrayEquals(["COGNITO", "Google"]),
        PreventUserExistenceErrors: "ENABLED",
        EnableTokenRevocation: true,
      });
    });

    it("styles the hosted pages like the app: our colours in light and dark mode, and our wordmark", () => {
      const style = Object.values(template().findResources("AWS::Cognito::ManagedLoginBranding"))[0].Properties;
      assert.equal(style.UseCognitoProvidedValues, false);
      const s = style.Settings;
      assert.equal(s.categories.global.colorSchemeMode, "DYNAMIC");
      assert.equal(s.components.primaryButton.lightMode.defaults.backgroundColor, "26336bff"); // --accent
      assert.equal(s.components.primaryButton.darkMode.defaults.backgroundColor, "aab6f2ff");
      assert.equal(s.components.pageBackground.lightMode.color, "f6f1e7ff"); // --paper
      assert.equal(s.components.form.lightMode.backgroundColor, "fffcf6ff"); // --card
      assert.equal(s.components.form.logo.enabled, true);
      const logos = (style.Assets as { Category: string; ColorMode: string; Extension: string; Bytes: string }[])
        .filter((a) => a.Category === "FORM_LOGO");
      assert.deepEqual(logos.map((a) => a.ColorMode).sort(), ["DARK", "LIGHT"]);
      for (const logo of logos) {
        assert.equal(logo.Extension, "SVG");
        assert.match(Buffer.from(logo.Bytes, "base64").toString("utf8"), /<svg[^>]*>.*Polygossa.*<\/svg>/s);
      }
    });

    it("offers Sign in with Google, its secret read from Secrets Manager at deploy and never in the template", () => {
      template().hasResourceProperties("AWS::Cognito::UserPoolIdentityProvider", {
        ProviderName: "Google",
        ProviderType: "Google",
        ProviderDetails: Match.objectLike({
          client_id: GOOGLE_CLIENT,
          authorize_scopes: "openid email profile",
        }),
        AttributeMapping: { email: "email", email_verified: "email_verified" },
      });
      const details = JSON.stringify(
        Object.values(template().findResources("AWS::Cognito::UserPoolIdentityProvider"))[0].Properties.ProviderDetails);
      assert.match(details, /resolve:secretsmanager:[^"]*polygossa\/google-oauth:SecretString:clientSecret/);
    });
  });
}

describe("production's pool", () => {
  it("is kept if its stack is deleted; QA's isn't", () => {
    production.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Retain" });
    qa.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Delete" });
  });

  it("is named to the backend and the frontend, which knows its own address", () => {
    assert.ok(["COGNITO_ISSUER", "COGNITO_CLIENT_ID"].every((n) => envNames(container(production, "backend")).includes(n)));
    const frontend = container(production, "frontend");
    assert.ok(["COGNITO_DOMAIN", "COGNITO_CLIENT_ID", "APP_URL"].every((n) => envNames(frontend).includes(n)));
    assert.equal(envValue(frontend, "APP_URL"), SITE);
  });
});

describe("QA stack", () => {
  it("holds only the QA user pool: no servers or database", () => {
    assert.deepEqual(Object.keys(qa.findResources("AWS::ECS::Service")), []);
    assert.deepEqual(Object.keys(qa.findResources("AWS::RDS::DBInstance")), []);
  });
});
