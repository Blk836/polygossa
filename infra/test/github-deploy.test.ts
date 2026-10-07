// docs/acceptance/staging.feature, "Only main can deploy": the deploy role's trust, synthesized without AWS access.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { GitHubDeployStack } from "../lib/github-deploy-stack.ts";

const template = Template.fromStack(new GitHubDeployStack(new cdk.App(), "Deploy", {
  env: { account: "111111111111", region: "eu-west-1" },
  repository: "Owner/repo",
}));

const role = () => Object.values(template.findResources("AWS::IAM::Role"))
  .find((r) => r.Properties.RoleName === "polygossa-github-deploy")!;

describe("GitHub deploy role", () => {
  it("can only be assumed by the repository's main branch, through GitHub's OIDC tokens", () => {
    const statement = role().Properties.AssumeRolePolicyDocument.Statement[0];
    assert.equal(statement.Action, "sts:AssumeRoleWithWebIdentity");
    assert.deepEqual(statement.Condition, {
      StringEquals: {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:Owner/repo:ref:refs/heads/main",
      },
    });
  });

  it("may only assume CDK's bootstrap roles and read stack outputs", () => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    const statements = policies.flatMap((p) => p.Properties.PolicyDocument.Statement);
    assert.deepEqual(statements.map((s) => s.Action).sort(), ["cloudformation:DescribeStacks", "sts:AssumeRole"]);
    const assume = statements.find((s) => s.Action === "sts:AssumeRole");
    assert.match(JSON.stringify(assume.Resource), /role\/cdk-hnb659fds-\*-111111111111-\*/);
  });

  it("trusts GitHub's token issuer", () => {
    const provider = Object.values(template.findResources("Custom::AWSCDKOpenIdConnectProvider"))[0];
    assert.equal(provider.Properties.Url, "https://token.actions.githubusercontent.com");
    assert.deepEqual(provider.Properties.ClientIDList, ["sts.amazonaws.com"]);
  });
});
