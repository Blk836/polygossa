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

type Statement = { Action: string | string[]; Resource: unknown; Condition?: unknown };

function statementsOf(prefix: string): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy"))
    .filter((p) => JSON.stringify(p.Properties.Roles).includes(prefix))
    .flatMap((p) => p.Properties.PolicyDocument.Statement as Statement[]);
}

const actions = (s: Statement) => [s.Action].flat();
const translateStatements = (prefix: string) => statementsOf(prefix).filter((s) => actions(s).some((a) => a.startsWith("translate:")));

function backendEnvironment(): Record<string, string> {
  for (const task of Object.values(template.findResources("AWS::ECS::TaskDefinition"))) {
    const backend = (task.Properties.ContainerDefinitions as { Name: string; Environment?: { Name: string; Value: string }[] }[])
      .find((c) => c.Name === "backend");
    if (backend) return Object.fromEntries((backend.Environment ?? []).map((e) => [e.Name, e.Value]));
  }
  throw new Error("no backend container");
}

describe("machine translation in production", () => {
  it("lets the backend call TranslateText only, in eu-west-1 only", () => {
    const statements = translateStatements("BackendTaskTaskRole");
    assert.equal(statements.length, 1);
    assert.deepEqual(actions(statements[0]), ["translate:TranslateText"]);
    assert.equal(statements[0].Resource, "*");
    assert.deepEqual(statements[0].Condition, { StringEquals: { "aws:RequestedRegion": "eu-west-1" } });
  });

  it("gives the frontend no Translate permission", () => {
    assert.equal(translateStatements("FrontendTask").length, 0);
  });

  it("switches machine translation on with the $20 monthly cap", () => {
    const env = backendEnvironment();
    assert.equal(env.TRANSLATION_ENABLED, "true");
    assert.equal(env.TRANSLATION_REGION, "eu-west-1");
    assert.equal(env.TRANSLATION_MONTHLY_CHARACTER_CAP, "1333333");
  });
});
