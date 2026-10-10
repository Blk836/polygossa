import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ProductionStack } from "../lib/production-stack.ts";

let template: Template;

before(() => {
  const app = new cdk.App();
  const stack = new ProductionStack(app, "Production", {
    env: { account: "111111111111", region: "eu-west-1" },
    cloudFrontPrefixListId: "pl-cloudfront",
  });
  template = Template.fromStack(stack);
});

function container(name: string): Record<string, unknown> {
  const tasks = template.findResources("AWS::ECS::TaskDefinition");
  for (const task of Object.values(tasks)) {
    const found = (task.Properties.ContainerDefinitions as Record<string, unknown>[]).find((c) => c.Name === name);
    if (found) return found;
  }
  throw new Error(`no container ${name}`);
}

const envOf = (c: Record<string, unknown>) =>
  Object.fromEntries((c.Environment as { Name: string; Value: unknown }[]).map((e) => [e.Name, e.Value]));
const secretNames = (c: Record<string, unknown>) => (c.Secrets as { Name: string }[]).map((s) => s.Name).sort();

function ingressInto(prefix: string) {
  const rules = Object.values(template.findResources("AWS::EC2::SecurityGroupIngress"));
  return rules.filter((r) => JSON.stringify(r.Properties.GroupId).includes(prefix)).map((r) => r.Properties);
}

describe("production stack", () => {
  it("has a PostgreSQL database that isn't publicly accessible, with encrypted storage, kept as a snapshot", () => {
    template.hasResource("AWS::RDS::DBInstance", {
      Properties: Match.objectLike({
        Engine: "postgres",
        PubliclyAccessible: false,
        StorageEncrypted: true,
        DBName: "lector",
        MultiAZ: false,
      }),
      DeletionPolicy: "Snapshot",
    });
  });

  it("keeps its small database: one zone, the smallest instance, 1 day of backups, no growth or delete lock", () => {
    template.hasResourceProperties("AWS::RDS::DBInstance", {
      DBInstanceClass: "db.t4g.micro",
      MultiAZ: false,
      AllocatedStorage: "20",
      BackupRetentionPeriod: 1,
      MaxAllocatedStorage: Match.absent(),
      DeletionProtection: Match.absent(),
    });
  });

  it("generates the database credentials, the login-token secret and the curator token in Secrets Manager", () => {
    template.resourceCountIs("AWS::SecretsManager::Secret", 3);
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      GenerateSecretString: Match.objectLike({ PasswordLength: 64, ExcludePunctuation: true }),
    });
    assert.deepEqual(secretNames(container("backend")),
      ["CURATOR_TOKEN", "DATABASE_PASSWORD", "DATABASE_USER", "JWT_SECRET", "OPENAI_API_KEY", "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET"]);
    const env = envOf(container("backend"));
    for (const name of ["CURATOR_TOKEN", "DATABASE_PASSWORD", "JWT_SECRET", "OPENAI_API_KEY", "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET"]) {
      assert.equal(env[name], undefined, `${name} in plain env`);
    }
  });

  it("generates the curator token under a fixed name, for the import tool", () => {
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: "polygossa/curator-token",
      GenerateSecretString: Match.objectLike({ PasswordLength: 64, ExcludePunctuation: true }),
    });
  });

  it("runs the prod profile with auto-login off", () => {
    assert.equal(envOf(container("backend")).SPRING_PROFILES_ACTIVE, "prod");
    assert.equal(envOf(container("frontend")).AUTO_LOGIN, "false");
  });

  it("names the site's admins", () => {
    assert.equal(envOf(container("backend")).FORUM_ADMINS, "owner@example.com");
  });

  it("lets only the frontend reach the backend, and only the backend reach the database", () => {
    const intoBackend = ingressInto("BackendSecurityGroup");
    assert.equal(intoBackend.length, 1);
    assert.equal(intoBackend[0].FromPort, 8080);
    assert.match(JSON.stringify(intoBackend[0].SourceSecurityGroupId), /FrontendSecurityGroup/);
    const intoDatabase = ingressInto("DatabaseSecurityGroup");
    assert.equal(intoDatabase.length, 1);
    assert.match(JSON.stringify(intoDatabase[0].SourceSecurityGroupId), /BackendSecurityGroup/);
  });

  it("gives the backend no load balancer, only a private name", () => {
    const services = template.findResources("AWS::ECS::Service");
    const backend = Object.entries(services).find(([id]) => id.startsWith("Backend"))![1];
    assert.equal(backend.Properties.LoadBalancers, undefined);
    assert.ok(backend.Properties.ServiceRegistries?.length === 1);
    assert.equal(envOf(container("frontend")).BACKEND_URL, "http://backend.polygossa.internal:8080");
  });

  it("checks the frontend's health on a file the frontend serves without signing in", () => {
    const groups = Object.values(template.findResources("AWS::ElasticLoadBalancingV2::TargetGroup"));
    const paths = groups.map((g) => g.Properties.HealthCheckPath as string);
    assert.deepEqual(paths, ["/icon.svg"]);
    assert.ok(existsSync(join(import.meta.dirname, "..", "..", "frontend", "app", "icon.svg")));
  });

  it("opens the load balancer to CloudFront only", () => {
    const intoBalancer = ingressInto("BalancerSecurity");
    assert.equal(intoBalancer.length, 1);
    assert.equal(intoBalancer[0].SourcePrefixListId, "pl-cloudfront");
    assert.equal(intoBalancer[0].FromPort, 80);
    template.hasResourceProperties("AWS::ElasticLoadBalancingV2::LoadBalancer", { Scheme: "internet-facing" });
  });

  it("serves the site through CloudFront over HTTPS, uncached, forwarding everything", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "redirect-to-https",
          CachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
          OriginRequestPolicyId: "216adef6-5c7f-47e4-b989-5492eafa07d3",
          AllowedMethods: Match.arrayWith(["PUT", "PATCH", "POST", "DELETE"]),
        }),
      }),
    });
    template.hasOutput("SiteUrl", {});
  });

  it("stays small: no NAT gateway, one task each", () => {
    template.resourceCountIs("AWS::EC2::NatGateway", 0);
    for (const service of Object.values(template.findResources("AWS::ECS::Service"))) {
      assert.equal(service.Properties.DesiredCount, 1);
    }
  });
});
