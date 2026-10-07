import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { IgnoreMode } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";

/** The repository root: the backend's Docker build context, as in docker-compose.yml. */
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Built by `cdk deploy` from the existing Dockerfiles and pushed to the account's CDK asset registry. */
export function backendImage(): ecs.ContainerImage {
  return ecs.ContainerImage.fromAsset(repo, {
    file: "backend/Dockerfile",
    platform: Platform.LINUX_AMD64,
    ignoreMode: IgnoreMode.DOCKER,
    // Only what the backend build reads; everything else would change the image's hash for nothing.
    exclude: ["*", "!gradlew", "!settings.gradle.kts", "!build.gradle.kts", "!gradle", "!backend",
      "backend/build", "backend/data", "backend/bin", "backend/out"],
  });
}

export function frontendImage(): ecs.ContainerImage {
  return ecs.ContainerImage.fromAsset(path.join(repo, "frontend"), {
    platform: Platform.LINUX_AMD64,
    ignoreMode: IgnoreMode.DOCKER,
    exclude: ["node_modules", ".next", "test-results", "playwright-report", "reports", ".stryker-tmp", "coverage",
      "*.tsbuildinfo", "next-env.d.ts", ".env*"],
  });
}
