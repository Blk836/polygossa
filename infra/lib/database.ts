import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import type { Construct } from "constructs";

export type DatabaseProfile = "small" | "safe";

const PROFILES: Record<DatabaseProfile, Partial<rds.DatabaseInstanceProps>> = {
  small: {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    multiAz: false,
    backupRetention: cdk.Duration.days(1),
    removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
  },
  safe: {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
    multiAz: true,
    backupRetention: cdk.Duration.days(14),
    copyTagsToSnapshot: true,
    deletionProtection: true,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    maxAllocatedStorage: 100,
  },
};

export type AppDatabase = rds.DatabaseInstance | rds.DatabaseInstanceFromSnapshot;

export function appDatabase(scope: Construct, vpc: ec2.IVpc, profile: DatabaseProfile, snapshot?: string): AppDatabase {
  const common = {
    engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_17 }),
    vpc,
    vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    publiclyAccessible: false,
    allocatedStorage: 20,
    storageType: rds.StorageType.GP3,
    ...PROFILES[profile],
  };
  if (snapshot) {
    return new rds.DatabaseInstanceFromSnapshot(scope, "Database", {
      ...common,
      snapshotIdentifier: snapshot,
      credentials: rds.SnapshotCredentials.fromGeneratedSecret("lector"),
    });
  }
  return new rds.DatabaseInstance(scope, "Database", {
    ...common,
    storageEncrypted: true,
    databaseName: "lector",
    credentials: rds.Credentials.fromGeneratedSecret("lector"),
  });
}
