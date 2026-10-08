import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

/**
 * The bucket for uploaded audio and profile photos (docs/acceptance/s3-uploads.feature): private, encrypted, HTTPS
 * only, and kept with its files if the stack is ever deleted. Only `backendRole` may read, write and delete in it,
 * and the network reaches S3 through its own gateway endpoint (no internet hop, no charge).
 */
export function uploadsBucket(scope: Construct, vpc: ec2.Vpc, backendRole: iam.IGrantable): s3.Bucket {
  const bucket = new s3.Bucket(scope, "Uploads", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });
  bucket.grantRead(backendRole);
  bucket.grantPut(backendRole);
  bucket.grantDelete(backendRole);
  vpc.addGatewayEndpoint("S3Endpoint", {
    service: ec2.GatewayVpcEndpointAwsService.S3,
    subnets: [{ subnetType: ec2.SubnetType.PUBLIC }],
  });
  return bucket;
}
