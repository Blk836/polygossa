// docs/acceptance/cognito-login.feature, "The user pools are defined in CDK".
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { defineApp } from "../lib/app.ts";

const SITE = "https://site.example";
let production: Template;
let qa: Template;

before(() => {
  const app = new cdk.App({
    context: { "github-repo": "owner/repo", "github-subject": "repo:owner/repo", "site-url": SITE },
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
        AllowedOAuthScopes: Match.arrayEquals(["openid", "email"]),
        CallbackURLs: [`${home}/api/auth/callback`],
        LogoutURLs: [`${home}/`],
        SupportedIdentityProviders: ["COGNITO"],
        PreventUserExistenceErrors: "ENABLED",
        EnableTokenRevocation: true,
      });
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
