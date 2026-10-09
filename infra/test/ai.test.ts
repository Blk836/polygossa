import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { OPENAI_SECRET } from "../lib/production-stack.ts";
import { ProductionStack } from "../lib/production-stack.ts";

let template: Template;

before(() => {
  const app = new cdk.App();
  const stack = new ProductionStack(app, "Production", {
    env: { account: "111111111111", region: "eu-west-1" },
    cloudFrontPrefixListId: "pl-cloudfront",
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

const secretsOf = (name: string) => (container(name).Secrets ?? []) as { Name: string; ValueFrom: unknown }[];

describe("production AI", () => {
  it("gives the backend the OpenAI key from Secrets Manager, by name, never in the template", () => {
    assert.equal(OPENAI_SECRET, "polygossa/openai-api-key");
    const key = secretsOf("backend").find((s) => s.Name === "OPENAI_API_KEY");
    assert.ok(key, "backend has OPENAI_API_KEY");
    assert.match(JSON.stringify(key.ValueFrom), /secret:polygossa\/openai-api-key/);
    const env = JSON.stringify(container("backend").Environment);
    assert.doesNotMatch(env, /OPENAI_API_KEY/);
  });

  it("doesn't give the key to the frontend", () => {
    assert.equal(secretsOf("frontend").some((s) => s.Name === "OPENAI_API_KEY"), false);
  });
});
