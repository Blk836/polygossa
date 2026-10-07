import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import type { Construct } from "constructs";

export type DatabaseProfile = "small" | "safe";

/**
 * The two database settings (docs/acceptance/production-database.feature): production runs on the small ones while it
 * has no users and switches to the safe ones before the beta.
 */
const PROFILES: Record<DatabaseProfile, Partial<rds.DatabaseInstanceProps>> = {
  // Small and cheap: one zone, 1 day of backups, a final snapshot if it is ever removed.
  small: {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    multiAz: false,
    backupRetention: cdk.Duration.days(1),
    removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
  },
  // Paying users' data: a standby in a second zone, two weeks of point-in-time restore, never deleted by accident,
  // storage that grows before it fills.
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

/** The app's PostgreSQL database, private and encrypted, in the VPC's isolated subnets. */
export function appDatabase(scope: Construct, vpc: ec2.IVpc, profile: DatabaseProfile): rds.DatabaseInstance {
  return new rds.DatabaseInstance(scope, "Database", {
    engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_17 }),
    vpc,
    vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    publiclyAccessible: false,
    allocatedStorage: 20,
    storageEncrypted: true,
    databaseName: "lector",
    credentials: rds.Credentials.fromGeneratedSecret("lector"),
    ...PROFILES[profile],
  });
}
