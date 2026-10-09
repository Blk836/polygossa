import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { IgnoreMode } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function backendImage(): ecs.ContainerImage {
  return ecs.ContainerImage.fromAsset(repo, {
    file: "backend/Dockerfile",
    platform: Platform.LINUX_AMD64,
    ignoreMode: IgnoreMode.DOCKER,
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
