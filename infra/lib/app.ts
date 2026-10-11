import type * as cdk from "aws-cdk-lib";
import { GitHubDeployStack } from "./github-deploy-stack.ts";
import { ProductionStack } from "./production-stack.ts";
import { QaStack } from "./qa-stack.ts";

export function defineApp(app: cdk.App, env: cdk.Environment, cloudFrontPrefixListId?: string) {
  const tags = { project: "polygossa" };
  const googleClientId = app.node.tryGetContext("google-client-id") as string | undefined;
  const production = new ProductionStack(app, "PolygossaStaging", {
    env,
    description: "Production: Polygossa's site",
    tags: { ...tags, environment: "production" },
    cloudFrontPrefixListId,
    domain: app.node.tryGetContext("domain") as string | undefined,
    domainLive: app.node.tryGetContext("domain-live") === true,
    googleClientId,
    alertEmail: app.node.tryGetContext("alert-email") as string | undefined,
    paused: app.node.tryGetContext("paused") === true,
    databaseSnapshot: app.node.tryGetContext("database-snapshot") as string | undefined,
  });
  const qa = new QaStack(app, "PolygossaQa", {
    env,
    googleClientId,
    description: "QA: the user pool local runs sign in through",
    tags: { ...tags, environment: "qa" },
  });
  const deploy = new GitHubDeployStack(app, "PolygossaGitHubDeploy", {
    env,
    tags,
    repository: app.node.tryGetContext("github-repo") as string,
    subject: app.node.tryGetContext("github-subject") as string,
  });
  return { production, qa, deploy };
}
