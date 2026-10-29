import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
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

type Statement = { Action: string | string[] };

function translateActions(): string[] {
  return Object.values(template.findResources("AWS::IAM::Policy"))
    .flatMap((p) => p.Properties.PolicyDocument.Statement as Statement[])
    .flatMap((s) => [s.Action].flat())
    .filter((a) => a.startsWith("translate:"));
}

function backendEnvironment(): Record<string, string> {
  for (const task of Object.values(template.findResources("AWS::ECS::TaskDefinition"))) {
    const backend = (task.Properties.ContainerDefinitions as { Name: string; Environment?: { Name: string; Value: string }[] }[])
      .find((c) => c.Name === "backend");
    if (backend) return Object.fromEntries((backend.Environment ?? []).map((e) => [e.Name, e.Value]));
  }
  throw new Error("no backend container");
}

describe("Amazon Translate in production", () => {
  it("is not allowed for any task", () => {
    assert.deepEqual(translateActions(), []);
  });

  it("has no settings on the backend", () => {
    const names = Object.keys(backendEnvironment()).filter((k) => k.startsWith("TRANSLATION_") || k.startsWith("PRICE_TRANSLATE"));
    assert.deepEqual(names, []);
  });
});
