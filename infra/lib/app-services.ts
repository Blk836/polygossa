import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import type * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import type { AppDatabase } from "./database.ts";
import { backendImage, frontendImage } from "./images.ts";
import type { Login } from "./login.ts";
import { appLogs, BACKEND_NAME, NAMESPACE } from "./services.ts";

export const OPENAI_SECRET = "polygossa/openai-api-key";

export const STRIPE_SECRET = "polygossa/stripe-secret-key";
export const STRIPE_WEBHOOK_SECRET = "polygossa/stripe-webhook-secret";
export const STRIPE_WEBHOOK_SECRET_ARN_SUFFIX = "jABTGF";

export interface AppParts {
  readonly vpc: ec2.IVpc;
  readonly listener: elbv2.ApplicationListener;
  readonly database: AppDatabase;
  readonly login: Login;
  readonly siteUrl: string;
  readonly uploads: s3.IBucket;
  readonly jwtSecret: secretsmanager.ISecret;
  readonly curatorToken: secretsmanager.ISecret;
}

export interface RunningApp {
  readonly frontendTargets: elbv2.ApplicationTargetGroup;
  readonly backend: ecs.FargateService;
}

const publicTasks = { assignPublicIp: true, vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC } };

export function appServices(scope: cdk.Stack, parts: AppParts): RunningApp {
  const cluster = new ecs.Cluster(scope, "Cluster", {
    vpc: parts.vpc,
    defaultCloudMapNamespace: { name: NAMESPACE, useForServiceConnect: false },
  });
  const backend = backendService(scope, cluster, parts);
  const frontendTask = new ecs.FargateTaskDefinition(scope, "FrontendTask", { cpu: 256, memoryLimitMiB: 512 });
  frontendTask.addContainer("frontend", {
    image: frontendImage(),
    portMappings: [{ containerPort: 3000 }],
    logging: appLogs(scope, "frontend"),
    environment: {
      BACKEND_URL: `http://${BACKEND_NAME}.${NAMESPACE}:8080`,
      AUTO_LOGIN: "false",
      COGNITO_DOMAIN: parts.login.domain,
      COGNITO_CLIENT_ID: parts.login.clientId,
      APP_URL: parts.siteUrl,
    },
  });
  const frontend = new ecs.FargateService(scope, "Frontend", {
    cluster,
    taskDefinition: frontendTask,
    desiredCount: 1,
    ...publicTasks,
    circuitBreaker: { rollback: true },
  });
  backend.connections.allowFrom(frontend, ec2.Port.tcp(8080), "the frontend");

  const frontendTargets = parts.listener.addTargets("Frontend", {
    port: 3000,
    protocol: elbv2.ApplicationProtocol.HTTP,
    targets: [frontend],
    healthCheck: { path: "/icon.svg", healthyHttpCodes: "200" },
    deregistrationDelay: cdk.Duration.seconds(10),
  });
  return { frontendTargets, backend };
}

function backendService(scope: cdk.Stack, cluster: ecs.Cluster, parts: AppParts): ecs.FargateService {
  const { database, login, uploads } = parts;
  const backendTask = new ecs.FargateTaskDefinition(scope, "BackendTask", { cpu: 512, memoryLimitMiB: 1024 });
  uploads.grantRead(backendTask.taskRole);
  uploads.grantPut(backendTask.taskRole);
  uploads.grantDelete(backendTask.taskRole);
  backendTask.addContainer("backend", {
    image: backendImage(),
    portMappings: [{ containerPort: 8080 }],
    logging: appLogs(scope, "backend"),
    environment: {
      SPRING_PROFILES_ACTIVE: "prod",
      DATABASE_URL: `jdbc:postgresql://${database.dbInstanceEndpointAddress}:${database.dbInstanceEndpointPort}/lector`,
      SPRING_CACHE_TYPE: "simple",
      MANAGEMENT_HEALTH_REDIS_ENABLED: "false",
      JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=75",
      STORAGE_S3_BUCKET: uploads.bucketName,
      STORAGE_S3_REGION: scope.region,
      COGNITO_ISSUER: login.issuer,
      COGNITO_CLIENT_ID: login.clientId,
      FORUM_ADMINS: "owner@example.com",
      APP_URL: parts.siteUrl,
      TRANSLATION_ENABLED: "true",
      TRANSLATION_REGION: scope.region,
      TRANSLATION_MONTHLY_CHARACTER_CAP: "1333333",
    },
    secrets: {
      DATABASE_USER: ecs.Secret.fromSecretsManager(database.secret!, "username"),
      DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, "password"),
      JWT_SECRET: ecs.Secret.fromSecretsManager(parts.jwtSecret),
      CURATOR_TOKEN: ecs.Secret.fromSecretsManager(parts.curatorToken),
      OPENAI_API_KEY: ecs.Secret.fromSecretsManager(
        secretsmanager.Secret.fromSecretNameV2(scope, "OpenAiKey", OPENAI_SECRET)),
      STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(
        secretsmanager.Secret.fromSecretNameV2(scope, "StripeKey", STRIPE_SECRET)),
      STRIPE_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(
        secretsmanager.Secret.fromSecretCompleteArn(scope, "StripeWebhookSecret", scope.formatArn({
          service: "secretsmanager", resource: "secret", arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
          resourceName: `${STRIPE_WEBHOOK_SECRET}-${STRIPE_WEBHOOK_SECRET_ARN_SUFFIX}`,
        }))),
    },
  });
  backendTask.addToTaskRolePolicy(new iam.PolicyStatement({
    actions: ["translate:TranslateText"],
    resources: ["*"],
    conditions: { StringEquals: { "aws:RequestedRegion": scope.region } },
  }));
  const backend = new ecs.FargateService(scope, "Backend", {
    cluster,
    taskDefinition: backendTask,
    desiredCount: 1,
    ...publicTasks,
    cloudMapOptions: { name: BACKEND_NAME },
    circuitBreaker: { rollback: true },
  });
  database.connections.allowDefaultPortFrom(backend, "the backend");
  return backend;
}
