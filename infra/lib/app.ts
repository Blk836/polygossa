import type * as cdk from "aws-cdk-lib";
import { GitHubDeployStack } from "./github-deploy-stack.ts";
import { ProductionStack } from "./production-stack.ts";

/**
 * The app's stacks. Production is the stack first built as staging (docs/acceptance/staging-becomes-production.feature):
 * it keeps the CloudFormation name PolygossaStaging, because renaming a stack creates a new one and deletes the old one
 * with its database.
 */
export function defineApp(app: cdk.App, env: cdk.Environment, cloudFrontPrefixListId?: string) {
  const tags = { project: "polygossa" };
  const production = new ProductionStack(app, "PolygossaStaging", {
    env,
    description: "Production: Polygossa's site",
    tags: { ...tags, environment: "production" },
    cloudFrontPrefixListId,
  });
  const deploy = new GitHubDeployStack(app, "PolygossaGitHubDeploy", {
    env,
    tags,
    repository: app.node.tryGetContext("github-repo") as string,
    subject: app.node.tryGetContext("github-subject") as string,
  });
  return { production, deploy };
}
