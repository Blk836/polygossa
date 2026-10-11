import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { IgnoreMode } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function ignored(file: string): string[] {
  return readFileSync(path.join(repo, file), "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export const BACKEND_IGNORE = "backend/Dockerfile.dockerignore";
export const FRONTEND_IGNORE = "frontend/.dockerignore";

export function backendImage(): ecs.ContainerImage {
  return ecs.ContainerImage.fromAsset(repo, {
    file: "backend/Dockerfile",
    platform: Platform.LINUX_AMD64,
    ignoreMode: IgnoreMode.DOCKER,
    exclude: ignored(BACKEND_IGNORE),
  });
}

export function frontendImage(): ecs.ContainerImage {
  return ecs.ContainerImage.fromAsset(path.join(repo, "frontend"), {
    platform: Platform.LINUX_AMD64,
    ignoreMode: IgnoreMode.DOCKER,
    exclude: ignored(FRONTEND_IGNORE),
  });
}
