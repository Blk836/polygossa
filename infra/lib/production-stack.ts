import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import { appDatabase } from "./database.ts";
import { backendImage, frontendImage } from "./images.ts";
import { appLogs, BACKEND_NAME, NAMESPACE } from "./services.ts";
import { userPool } from "./login.ts";
import { monitoring } from "./monitoring.ts";
import { uploadsBucket } from "./uploads.ts";

/**
 * The OpenAI API key for the AI features (docs/acceptance/production-ai.feature): a Secrets Manager entry made by
 * hand (its value can't be in code), read by ECS when the backend starts, so it never appears in the template.
 */
export const OPENAI_SECRET = "polygossa/openai-api-key";

export interface ProductionProps extends cdk.StackProps {
  /** CloudFront's origin-facing prefix list; looked up in the account when absent (tests pass one). */
  readonly cloudFrontPrefixListId?: string;
  /**
   * The site's public address (cdk.json's `site-url`: CloudFront's, until there is a domain). Sign-in returns there.
   * It can't be read from the distribution itself: the frontend's settings would then depend on the distribution,
   * which depends on the frontend.
   */
  readonly siteUrl?: string;
  /** The owner's Google OAuth client (cdk.json's `google-client-id`), for Sign in with Google. */
  readonly googleClientId?: string;
  /** Where production's alarms and budget warnings are emailed (cdk.json's `alert-email`); none without it. */
  readonly alertEmail?: string;
}

/**
 * Production, first built as staging (docs/acceptance/staging.feature, staging-becomes-production.feature):
 * CloudFront → load balancer → frontend on Fargate → backend on Fargate (private name only) → PostgreSQL on RDS in
 * isolated subnets. Sized small until the beta: no NAT gateway (tasks get public IPs to pull images and call out), one
 * task each, a single-zone database.
 */
export class ProductionStack extends cdk.Stack {
  readonly siteUrl: string;

  constructor(scope: Construct, id: string, props: ProductionProps = {}) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Network", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "data", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    const database = appDatabase(this, vpc, "small");

    const jwtSecret = new secretsmanager.Secret(this, "LoginTokenSecret", {
      description: "Signs the app's login tokens (JWT_SECRET).",
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      defaultCloudMapNamespace: { name: NAMESPACE, useForServiceConnect: false },
    });
    const publicTasks = { assignPublicIp: true, vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC } };

    // Backend: no load balancer and no public route in; the frontend calls it at backend.<namespace>:8080.
    const siteUrl = props.siteUrl ?? "https://site.invalid";
    const login = userPool(this, {
      domainPrefix: "polygossa",
      siteUrl,
      keep: true,
      googleClientId: props.googleClientId ?? "unset.apps.googleusercontent.com",
    });

    const backendTask = new ecs.FargateTaskDefinition(this, "BackendTask", { cpu: 512, memoryLimitMiB: 1024 });
    const uploads = uploadsBucket(this, vpc, backendTask.taskRole);
    backendTask.addContainer("backend", {
      image: backendImage(),
      portMappings: [{ containerPort: 8080 }],
      logging: appLogs(this, "backend"),
      environment: {
        SPRING_PROFILES_ACTIVE: "prod",
        DATABASE_URL: `jdbc:postgresql://${database.dbInstanceEndpointAddress}:${database.dbInstanceEndpointPort}/lector`,
        // No Redis yet: dictionary lookups are cached in memory.
        SPRING_CACHE_TYPE: "simple",
        MANAGEMENT_HEALTH_REDIS_ENABLED: "false",
        JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=75",
        // Uploads (audio, profile photos) live in S3, so they survive redeploys.
        STORAGE_S3_BUCKET: uploads.bucketName,
        STORAGE_S3_REGION: this.region,
        // Everyone signs in through the user pool (the prod profile turns the app's own accounts off).
        COGNITO_ISSUER: login.issuer,
        COGNITO_CLIENT_ID: login.clientId,
        // The team (admin panel, forum moderation); the prod profile names nobody by default.
        FORUM_ADMINS: "owner@example.com",
      },
      secrets: {
        DATABASE_USER: ecs.Secret.fromSecretsManager(database.secret!, "username"),
        DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, "password"),
        JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(
          secretsmanager.Secret.fromSecretNameV2(this, "OpenAiKey", OPENAI_SECRET)),
      },
    });
    const backend = new ecs.FargateService(this, "Backend", {
      cluster,
      taskDefinition: backendTask,
      desiredCount: 1,
      ...publicTasks,
      cloudMapOptions: { name: BACKEND_NAME },
      circuitBreaker: { rollback: true },
    });
    database.connections.allowDefaultPortFrom(backend, "the backend");

    // Frontend: behind the load balancer, which only CloudFront can reach.
    const frontendTask = new ecs.FargateTaskDefinition(this, "FrontendTask", { cpu: 256, memoryLimitMiB: 512 });
    frontendTask.addContainer("frontend", {
      image: frontendImage(),
      portMappings: [{ containerPort: 3000 }],
      logging: appLogs(this, "frontend"),
      environment: {
        BACKEND_URL: `http://${BACKEND_NAME}.${NAMESPACE}:8080`,
        // Real sign-up and login: the test-account auto-login is off (the backend's prod profile refuses it too).
        AUTO_LOGIN: "false",
        // Sign-in through Cognito's hosted pages, which return to this site.
        COGNITO_DOMAIN: login.domain,
        COGNITO_CLIENT_ID: login.clientId,
        APP_URL: siteUrl,
      },
    });
    const frontend = new ecs.FargateService(this, "Frontend", {
      cluster,
      taskDefinition: frontendTask,
      desiredCount: 1,
      ...publicTasks,
      circuitBreaker: { rollback: true },
    });
    backend.connections.allowFrom(frontend, ec2.Port.tcp(8080), "the frontend");

    const balancerGroup = new ec2.SecurityGroup(this, "BalancerSecurity", {
      vpc,
      description: "The load balancer: reachable from CloudFront only",
      allowAllOutbound: true,
    });
    const cloudFront = props.cloudFrontPrefixListId
      ?? ec2.PrefixList.fromLookup(this, "CloudFrontOrigins", {
        prefixListName: "com.amazonaws.global.cloudfront.origin-facing",
      }).prefixListId;
    balancerGroup.addIngressRule(ec2.Peer.prefixList(cloudFront), ec2.Port.tcp(80), "CloudFront");
    const balancer = new elbv2.ApplicationLoadBalancer(this, "Balancer", {
      vpc,
      internetFacing: true,
      securityGroup: balancerGroup,
    });
    const frontendTargets = balancer.addListener("Http", { port: 80, open: false }).addTargets("Frontend", {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [frontend],
      // favicon.ico skips the login redirect (proxy.ts), so it answers 200 with no session.
      healthCheck: { path: "/favicon.ico", healthyHttpCodes: "200" },
      deregistrationDelay: cdk.Duration.seconds(10),
    });

    const distribution = new cloudfront.Distribution(this, "Site", {
      comment: "Polygossa production",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(balancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          readTimeout: cdk.Duration.seconds(60),
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // The app is per-user (login cookie), so nothing is cached and everything reaches it as sent.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
    });

    if (props.alertEmail) monitoring(this, { email: props.alertEmail, frontendTargets, backend, database });

    this.siteUrl = `https://${distribution.distributionDomainName}`;
    new cdk.CfnOutput(this, "SiteUrl", { value: this.siteUrl, description: "The production site" });
  }
}
