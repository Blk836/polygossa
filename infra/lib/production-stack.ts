import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import { appServices } from "./app-services.ts";
import { comingSoonSite } from "./coming-soon.ts";
import { appDatabase } from "./database.ts";
import { hostedZone, siteDomain } from "./domain.ts";
import { userPool } from "./login.ts";
import { monitoring, type Watched } from "./monitoring.ts";
import { uploadsBucket } from "./uploads.ts";

export {
  OPENAI_SECRET, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_ARN_SUFFIX,
} from "./app-services.ts";

export interface ProductionProps extends cdk.StackProps {
  readonly cloudFrontPrefixListId?: string;
  readonly domain?: string;
  readonly domainLive?: boolean;
  readonly googleClientId?: string;
  readonly alertEmail?: string;
  readonly paused?: boolean;
  readonly databaseSnapshot?: string;
}

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

    const jwtSecret = new secretsmanager.Secret(this, "LoginTokenSecret", {
      description: "Signs the app's login tokens (JWT_SECRET).",
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });
    const curatorToken = new secretsmanager.Secret(this, "CuratorToken", {
      secretName: "polygossa/curator-token",
      description: "Lets the team's video import tool use the curator endpoints (CURATOR_TOKEN).",
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });
    const uploads = uploadsBucket(this, vpc);

    const zone = props.domain ? hostedZone(this, props.domain) : undefined;
    const domain = zone && props.domainLive ? siteDomain(this, zone, props.domain!) : undefined;
    const listener = props.paused ? undefined : this.balancer(vpc, props.cloudFrontPrefixListId);
    const page = listener ? undefined : comingSoonSite(this);

    const distribution = new cloudfront.Distribution(this, "Site", {
      comment: "Polygossa production",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      domainNames: domain?.names,
      certificate: domain?.certificate,
      defaultRootObject: page?.defaultRootObject,
      errorResponses: page?.errorResponses,
      defaultBehavior: {
        functionAssociations: domain ? [domain.redirect] : undefined,
        ...(page ? { origin: page.origin } : this.appBehavior(listener!)),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
    });
    this.siteUrl = domain ? `https://${props.domain}` : `https://${distribution.distributionDomainName}`;

    const login = userPool(this, {
      domainPrefix: "polygossa",
      siteUrl: this.siteUrl,
      keep: true,
      googleClientId: props.googleClientId ?? "unset.apps.googleusercontent.com",
    });

    let watched: Watched | undefined;
    if (listener) {
      const database = appDatabase(this, vpc, "small", props.databaseSnapshot);
      const app = appServices(this, {
        vpc, listener, database, login, siteUrl: this.siteUrl, uploads, jwtSecret, curatorToken,
      });
      watched = { ...app, database };
    }
    if (props.alertEmail) monitoring(this, props.alertEmail, watched);

    domain?.pointAt(distribution);
    new cdk.CfnOutput(this, "SiteUrl", { value: this.siteUrl, description: "The production site" });
    new cdk.CfnOutput(this, "Paused", {
      value: String(Boolean(props.paused)),
      description: "Whether production is paused behind its coming-soon page",
    });
    new cdk.CfnOutput(this, "DatabaseSnapshot", {
      value: props.databaseSnapshot ?? "none",
      description: "The snapshot the database was created from (none: created new)",
    });
  }

  private balancer(vpc: ec2.IVpc, cloudFrontPrefixListId?: string): elbv2.ApplicationListener {
    const balancerGroup = new ec2.SecurityGroup(this, "BalancerSecurity", {
      vpc,
      description: "The load balancer: reachable from CloudFront only",
      allowAllOutbound: true,
    });
    const cloudFront = cloudFrontPrefixListId
      ?? ec2.PrefixList.fromLookup(this, "CloudFrontOrigins", {
        prefixListName: "com.amazonaws.global.cloudfront.origin-facing",
      }).prefixListId;
    balancerGroup.addIngressRule(ec2.Peer.prefixList(cloudFront), ec2.Port.tcp(80), "CloudFront");
    const balancer = new elbv2.ApplicationLoadBalancer(this, "Balancer", {
      vpc,
      internetFacing: true,
      securityGroup: balancerGroup,
    });
    return balancer.addListener("Http", { port: 80, open: false });
  }

  private appBehavior(listener: elbv2.ApplicationListener) {
    return {
      origin: new origins.LoadBalancerV2Origin(listener.loadBalancer, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        readTimeout: cdk.Duration.seconds(60),
      }),
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
    };
  }
}
