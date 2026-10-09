// Regression: production's deploy failed because the backend couldn't read polygossa/stripe-webhook-secret. A secret
// name ending in a hyphen and six characters ("-secret") looks like a complete ARN with Secrets Manager's random
// suffix, so ECS asked for ".../stripe-webhook-secret" as a full ARN while the role was granted
// ".../stripe-webhook-secret-??????" (the by-name grant), and the tasks never started. Such a secret must be
// referenced by its complete ARN, and granted exactly that.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ProductionStack, STRIPE_WEBHOOK_SECRET_ARN_SUFFIX } from "../lib/production-stack.ts";

let template: Template;

before(() => {
  const app = new cdk.App();
  const stack = new ProductionStack(app, "Production", {
    env: { account: "111111111111", region: "eu-west-1" },
    cloudFrontPrefixListId: "pl-cloudfront",
  });
  template = Template.fromStack(stack);
});

const AMBIGUOUS = /-[A-Za-z0-9]{6}$/;

/** Secret names the stack's roles are granted by name (CDK's "-??????" pattern for a suffix it doesn't know). */
function grantedByName(): string[] {
  const text = JSON.stringify(template.findResources("AWS::IAM::Policy"));
  return [...text.matchAll(/secret:([A-Za-z0-9/_+=.@-]+?)-\?\?\?\?\?\?/g)].map((m) => m[1]);
}

function backendSecret(key: string): string {
  for (const task of Object.values(template.findResources("AWS::ECS::TaskDefinition"))) {
    const backend = (task.Properties.ContainerDefinitions as { Name: string; Secrets?: { Name: string; ValueFrom: unknown }[] }[])
      .find((c) => c.Name === "backend");
    const secret = backend?.Secrets?.find((s) => s.Name === key);
    if (secret) return JSON.stringify(secret.ValueFrom);
  }
  throw new Error(`backend has no secret ${key}`);
}

describe("secrets read by name", () => {
  it("never have a name Secrets Manager would mistake for a complete ARN", () => {
    const names = grantedByName();
    assert.ok(names.length > 0, "some secrets are granted by name");
    assert.deepEqual(names.filter((n) => AMBIGUOUS.test(n)), []);
  });

  it("references the Stripe webhook secret by its complete ARN, and grants exactly that", () => {
    const arn = `secret:polygossa/stripe-webhook-secret-${STRIPE_WEBHOOK_SECRET_ARN_SUFFIX}`;
    assert.match(STRIPE_WEBHOOK_SECRET_ARN_SUFFIX, /^[A-Za-z0-9]{6}$/);
    assert.ok(backendSecret("STRIPE_WEBHOOK_SECRET").includes(arn), "the task asks for the complete ARN");
    assert.ok(JSON.stringify(template.findResources("AWS::IAM::Policy")).includes(arn), "the role is granted it");
  });
});
