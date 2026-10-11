import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export function uploadsBucket(scope: Construct, vpc: ec2.Vpc): s3.Bucket {
  const bucket = new s3.Bucket(scope, "Uploads", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });
  vpc.addGatewayEndpoint("S3Endpoint", {
    service: ec2.GatewayVpcEndpointAwsService.S3,
    subnets: [{ subnetType: ec2.SubnetType.PUBLIC }],
  });
  return bucket;
}
