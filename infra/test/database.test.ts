import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Match, Template } from "aws-cdk-lib/assertions";
import { appDatabase } from "../lib/database.ts";

let template: Template;

before(() => {
  const stack = new cdk.Stack(new cdk.App(), "Production", { env: { account: "222222222222", region: "eu-west-1" } });
  const vpc = new ec2.Vpc(stack, "Network", {
    maxAzs: 2,
    natGateways: 0,
    subnetConfiguration: [
      { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      { name: "data", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
    ],
  });
  appDatabase(stack, vpc, "safe");
  template = Template.fromStack(stack);
});

const database = (properties: Record<string, unknown>) =>
  template.hasResourceProperties("AWS::RDS::DBInstance", Match.objectLike(properties));

describe("safe database settings", () => {
  it("runs in two availability zones", () => {
    database({ MultiAZ: true });
  });

  it("keeps 14 days of backups, so it can be restored to any moment in them, and tags them", () => {
    database({ BackupRetentionPeriod: 14, CopyTagsToSnapshot: true });
  });

  it("can't be deleted by accident, and is kept if its stack is deleted", () => {
    database({ DeletionProtection: true });
    template.hasResource("AWS::RDS::DBInstance", { DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain" });
  });

  it("is private and encrypted, in subnets with no internet route, with generated credentials", () => {
    database({ PubliclyAccessible: false, StorageEncrypted: true, Engine: "postgres", DBName: "lector" });
    const subnetGroups = Object.values(template.findResources("AWS::RDS::DBSubnetGroup"));
    const subnets = JSON.stringify(subnetGroups[0].Properties.SubnetIds);
    if (!subnets.includes("dataSubnet") || subnets.includes("publicSubnet")) {
      throw new Error(`database subnets aren't the isolated ones: ${subnets}`);
    }
    template.resourceCountIs("AWS::SecretsManager::Secret", 1);
  });

  it("starts at 20 GB of storage and grows by itself up to 100 GB", () => {
    database({ AllocatedStorage: "20", MaxAllocatedStorage: 100 });
  });
});
