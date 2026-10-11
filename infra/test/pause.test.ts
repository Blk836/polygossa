import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { defineApp } from "../lib/app.ts";
import { redirectSource } from "../lib/domain.ts";

const DOMAIN = "polygossa.com";
const SNAPSHOT = "polygossastaging-snapshot-database-abc123";

function production(context: Record<string, unknown> = {}): Template {
  const app = new cdk.App({
    context: {
      "github-repo": "owner/repo", "github-subject": "repo:owner/repo", domain: DOMAIN, "domain-live": true,
      "alert-email": "owner@example.com", ...context,
    },
  });
  return Template.fromStack(defineApp(app, { account: "111111111111", region: "eu-west-1" }, "pl-cloudfront").production);
}

const count = (template: Template, type: string) => Object.keys(template.findResources(type)).length;
const output = (template: Template, name: string) => template.findOutputs(name)[name]?.Value;
const alarms = (template: Template) => Object.keys(template.findResources("AWS::CloudWatch::Alarm"));
const distribution = (template: Template) =>
  Object.values(template.findResources("AWS::CloudFront::Distribution"))[0].Properties.DistributionConfig;
const comingSoonBucket = (template: Template) =>
  Object.keys(template.findResources("AWS::S3::Bucket")).find((id) => id.startsWith("ComingSoon"));
const images = (template: Template) => JSON.stringify(template.toJSON()).match(/container-assets/g) ?? [];

describe("production's settings", () => {
  it("leave production running", () => {
    const { context } = JSON.parse(readFileSync(new URL("../cdk.json", import.meta.url), "utf8"));
    assert.notEqual(context.paused, true);
  });
});

describe("running production", () => {
  const template = production();

  it("has its services, load balancer, database and alarms", () => {
    assert.equal(count(template, "AWS::ECS::Service"), 2);
    assert.equal(count(template, "AWS::ElasticLoadBalancingV2::LoadBalancer"), 1);
    assert.equal(count(template, "AWS::RDS::DBInstance"), 1);
    assert.deepEqual(alarms(template).map((id) => id.replace(/[0-9A-F]{8}$/, "")).sort(),
      ["BackendDown", "DatabaseCpu", "DatabaseStorage", "ServerErrors", "SiteDown"]);
  });

  it("serves the app from the load balancer, with no coming-soon origin or error pages", () => {
    const config = distribution(template);
    assert.equal(config.Origins.length, 1);
    assert.equal(config.Origins[0].S3OriginConfig, undefined);
    assert.equal(config.Origins[0].CustomOriginConfig.OriginProtocolPolicy, "http-only");
    assert.equal(config.CustomErrorResponses, undefined);
  });

  it("reports that it is running, with a new database", () => {
    assert.equal(output(template, "Paused"), "false");
    assert.equal(output(template, "DatabaseSnapshot"), "none");
  });

  it("stores the database on gp3", () => {
    template.hasResourceProperties("AWS::RDS::DBInstance", { StorageType: "gp3" });
  });
});

describe("paused production", () => {
  const template = production({ paused: true });

  it("has no cluster, services, tasks, load balancer, database or public addresses", () => {
    for (const type of ["AWS::ECS::Cluster", "AWS::ECS::Service", "AWS::ECS::TaskDefinition",
      "AWS::ElasticLoadBalancingV2::LoadBalancer", "AWS::RDS::DBInstance", "AWS::EC2::EIP",
      "AWS::ServiceDiscovery::PrivateDnsNamespace"]) {
      assert.equal(count(template, type), 0, type);
    }
  });

  it("builds no container images", () => {
    assert.deepEqual(images(template), []);
  });

  it("keeps the user pool, uploads, secrets, zone, certificate and the distribution on the domain", () => {
    template.hasResource("AWS::Cognito::UserPool", { DeletionPolicy: "Retain" });
    assert.ok(Object.keys(template.findResources("AWS::S3::Bucket")).some((id) => id.startsWith("Uploads")));
    template.hasResourceProperties("AWS::SecretsManager::Secret", { Name: "polygossa/curator-token" });
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Description: Match.stringLikeRegexp("JWT_SECRET"),
    });
    template.hasResource("AWS::Route53::HostedZone", { DeletionPolicy: "Retain" });
    assert.equal(Object.values(template.findResources("AWS::CloudFormation::CustomResource"))
      .filter((r) => r.Properties.DomainName === DOMAIN).length, 1);
    assert.deepEqual(distribution(template).Aliases, [DOMAIN, `www.${DOMAIN}`]);
  });

  it("still sends www to the bare domain", () => {
    template.hasResourceProperties("AWS::CloudFront::Function", { FunctionCode: redirectSource(DOMAIN) });
    assert.equal(distribution(template).DefaultCacheBehavior.FunctionAssociations[0].EventType, "viewer-request");
  });

  it("serves the coming-soon page from its bucket, for every path", () => {
    const config = distribution(template);
    assert.equal(config.Origins.length, 1);
    assert.deepEqual(config.Origins[0].DomainName["Fn::GetAtt"], [comingSoonBucket(template), "RegionalDomainName"]);
    assert.equal(config.DefaultRootObject, "index.html");
    for (const code of [403, 404]) {
      assert.ok(config.CustomErrorResponses.some((r: Record<string, unknown>) =>
        r.ErrorCode === code && r.ResponseCode === 200 && r.ResponsePagePath === "/index.html"), String(code));
    }
  });

  it("lets only the distribution read the coming-soon bucket", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
      },
    });
    const policies = Object.values(template.findResources("AWS::S3::BucketPolicy"))
      .filter((p) => JSON.stringify(p.Properties.Bucket).includes(comingSoonBucket(template)!));
    const statements = policies.flatMap((p) => p.Properties.PolicyDocument.Statement)
      .filter((s: Record<string, unknown>) => s.Effect === "Allow" && JSON.stringify(s.Action).includes("s3:GetObject"));
    assert.equal(statements.length, 1);
    assert.deepEqual(statements[0].Principal, { Service: "cloudfront.amazonaws.com" });
    assert.match(JSON.stringify(statements[0].Condition), /AWS:SourceArn/);
  });

  it("puts the coming-soon page in its bucket", () => {
    template.resourceCountIs("Custom::CDKBucketDeployment", 1);
    const page = readFileSync(new URL("../coming-soon/index.html", import.meta.url), "utf8");
    assert.match(page, /coming soon/i);
  });

  it("has no alarms, but keeps the monthly budget", () => {
    assert.deepEqual(alarms(template), []);
    template.resourceCountIs("AWS::Budgets::Budget", 1);
  });

  it("reports that it is paused", () => {
    assert.equal(output(template, "Paused"), "true");
    assert.equal(output(template, "SiteUrl"), `https://${DOMAIN}`);
  });

  it("can be previewed from the command line (cdk diff -c paused=true)", () => {
    assert.equal(output(production({ paused: "true" }), "Paused"), "true");
  });
});

describe("production unpaused from a snapshot", () => {
  const template = production({ "database-snapshot": SNAPSHOT });

  it("restores the database from the named snapshot, on gp3, kept as a snapshot if removed", () => {
    template.hasResource("AWS::RDS::DBInstance", {
      Properties: Match.objectLike({ DBSnapshotIdentifier: SNAPSHOT, StorageType: "gp3", DBName: Match.absent() }),
      DeletionPolicy: "Snapshot",
    });
  });

  it("gives it a newly generated password in its own secret, which the backend reads", () => {
    template.hasResourceProperties("AWS::RDS::DBInstance", {
      MasterUserPassword: Match.objectLike({ "Fn::Join": Match.anyValue() }),
    });
    const backend = Object.values(template.findResources("AWS::ECS::TaskDefinition"))
      .flatMap((t) => t.Properties.ContainerDefinitions).find((c) => c.Name === "backend");
    const names = (backend.Secrets as { Name: string }[]).map((s) => s.Name);
    assert.ok(names.includes("DATABASE_USER") && names.includes("DATABASE_PASSWORD"));
  });

  it("brings back the services, load balancer and alarms", () => {
    assert.equal(count(template, "AWS::ECS::Service"), 2);
    assert.equal(count(template, "AWS::ElasticLoadBalancingV2::LoadBalancer"), 1);
    assert.equal(alarms(template).length, 5);
  });

  it("reports the snapshot it came from", () => {
    assert.equal(output(template, "Paused"), "false");
    assert.equal(output(template, "DatabaseSnapshot"), SNAPSHOT);
  });
});
