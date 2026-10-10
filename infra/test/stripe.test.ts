import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ProductionStack, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET } from "../lib/production-stack.ts";

const SITE = "https://site.example";
let template: Template;

before(() => {
  const app = new cdk.App();
  const stack = new ProductionStack(app, "Production", {
    env: { account: "111111111111", region: "eu-west-1" },
    cloudFrontPrefixListId: "pl-cloudfront",
    siteUrl: SITE,
  });
  template = Template.fromStack(stack);
});

function container(name: string): Record<string, unknown> {
  for (const task of Object.values(template.findResources("AWS::ECS::TaskDefinition"))) {
    const found = (task.Properties.ContainerDefinitions as Record<string, unknown>[]).find((c) => c.Name === name);
    if (found) return found;
  }
  throw new Error(`no container ${name}`);
}

const secretFrom = (name: string, key: string) =>
  ((container(name).Secrets ?? []) as { Name: string; ValueFrom: unknown }[]).find((s) => s.Name === key);
const env = (name: string) =>
  Object.fromEntries((container(name).Environment as { Name: string; Value: unknown }[]).map((e) => [e.Name, e.Value]));

describe("Stripe in production", () => {
  it("gives the backend the secret key and the webhook signing secret from Secrets Manager, by name", () => {
    assert.equal(STRIPE_SECRET, "polygossa/stripe-secret-key");
    assert.equal(STRIPE_WEBHOOK_SECRET, "polygossa/stripe-webhook-secret");
    assert.match(JSON.stringify(secretFrom("backend", "STRIPE_SECRET_KEY")?.ValueFrom), /secret:polygossa\/stripe-secret-key/);
    assert.match(JSON.stringify(secretFrom("backend", "STRIPE_WEBHOOK_SECRET")?.ValueFrom),
      /secret:polygossa\/stripe-webhook-secret/);
    assert.equal(env("backend").STRIPE_SECRET_KEY, undefined);
  });

  it("tells the backend the site's address, where Checkout and the portal return", () => {
    assert.equal(env("backend").APP_URL, SITE);
  });

  it("never gives the frontend a Stripe key", () => {
    assert.equal(secretFrom("frontend", "STRIPE_SECRET_KEY"), undefined);
    assert.equal(secretFrom("frontend", "STRIPE_WEBHOOK_SECRET"), undefined);
  });
});
