import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

const PAGE_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "coming-soon");

export interface ComingSoonSite {
  readonly origin: cloudfront.IOrigin;
  readonly defaultRootObject: string;
  readonly errorResponses: cloudfront.ErrorResponse[];
}

export function comingSoonSite(scope: Construct): ComingSoonSite {
  const bucket = new s3.Bucket(scope, "ComingSoon", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });
  new s3deploy.BucketDeployment(scope, "ComingSoonPage", {
    sources: [s3deploy.Source.asset(PAGE_FOLDER)],
    destinationBucket: bucket,
  });
  const page = { responseHttpStatus: 200, responsePagePath: "/index.html" };
  return {
    origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
    defaultRootObject: "index.html",
    errorResponses: [{ httpStatus: 403, ...page }, { httpStatus: 404, ...page }],
  };
}
