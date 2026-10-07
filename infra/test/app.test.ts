// docs/acceptance/staging-becomes-production.feature: the app's stacks, as the deploy synthesizes them.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { defineApp } from "../lib/app.ts";

let app: cdk.App;
let production: cdk.Stack;
let template: Template;

before(() => {
  app = new cdk.App({ context: { "github-repo": "owner/repo", "github-subject": "repo:owner/repo" } });
  production = defineApp(app, { account: "111111111111", region: "eu-west-1" }, "pl-cloudfront").production;
  template = Template.fromStack(production);
});

describe("the app", () => {
  it("deploys production as the stack first built as staging, under the same CloudFormation name", () => {
    assert.equal(production.stackName, "PolygossaStaging");
    assert.equal(production.node.id, "PolygossaStaging");
  });

  it("describes the stack as production", () => {
    assert.match(template.toJSON().Description, /^Production/);
  });

  // Stack tags aren't in the template: CloudFormation puts them on every resource of the stack at deploy.
  it("tags production's resources as production", () => {
    assert.deepEqual(production.tags.tagValues(), { project: "polygossa", environment: "production" });
  });

  it("calls nothing in the stack staging, apart from the stack's kept name", () => {
    assert.doesNotMatch(JSON.stringify(template.toJSON()).replaceAll("PolygossaStaging", ""), /staging/i);
  });

  it("still has GitHub's deploy role stack", () => {
    assert.ok(app.node.tryFindChild("PolygossaGitHubDeploy"));
  });
});
