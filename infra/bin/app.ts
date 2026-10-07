// The CDK app: `npx cdk deploy PolygossaStaging` (the deploy job does this) or `npx cdk diff` to preview a change.
// Everything holding user data lives in Ireland (docs/production.md); the account is the one you're signed in to.
import * as cdk from "aws-cdk-lib";
import { GitHubDeployStack } from "../lib/github-deploy-stack.ts";
import { StagingStack } from "../lib/staging-stack.ts";

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" };
const tags = { project: "polygossa" };

new StagingStack(app, "PolygossaStaging", { env, tags: { ...tags, environment: "staging" } });
new GitHubDeployStack(app, "PolygossaGitHubDeploy", {
  env,
  tags,
  repository: app.node.tryGetContext("github-repo") as string,
  subject: app.node.tryGetContext("github-subject") as string,
});
