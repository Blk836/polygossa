// docs/acceptance/s3-uploads.feature, "The bucket is private, encrypted and only the backend can use it".
import assert from "node:assert/strict";
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

const bucketId = () => Object.keys(template.findResources("AWS::S3::Bucket"))[0];

/** The IAM policy documents attached to the role whose logical id starts with `prefix`. */
function statementsOf(prefix: string) {
  const policies = Object.values(template.findResources("AWS::IAM::Policy"));
  return policies
    .filter((p) => JSON.stringify(p.Properties.Roles).includes(prefix))
    .flatMap((p) => p.Properties.PolicyDocument.Statement as { Action: string | string[]; Resource: unknown }[]);
}

const touchesBucket = (s: { Resource: unknown }) => JSON.stringify(s.Resource).includes(bucketId());

describe("uploads bucket", () => {
  it("is a single bucket that blocks all public access and encrypts files", () => {
    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
      },
      BucketEncryption: { ServerSideEncryptionConfiguration: [Match.objectLike({
        ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
      })] },
    });
  });

  it("refuses plain HTTP", () => {
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({
        Effect: "Deny",
        Condition: { Bool: { "aws:SecureTransport": "false" } },
      })]) },
    });
  });

  it("is kept, with its files, if the stack is deleted", () => {
    template.hasResource("AWS::S3::Bucket", { DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain" });
  });

  it("is named to the backend, which may read, write and delete its files", () => {
    const backend = template.findResources("AWS::ECS::TaskDefinition", {
      Properties: { ContainerDefinitions: [Match.objectLike({ Name: "backend" })] },
    });
    const env = JSON.stringify(Object.values(backend)[0].Properties.ContainerDefinitions[0].Environment);
    assert.match(env, /STORAGE_S3_BUCKET/);
    assert.ok(env.includes(bucketId()));

    const actions = statementsOf("BackendTaskTaskRole").filter(touchesBucket).flatMap((s) => [s.Action].flat());
    for (const needed of ["s3:GetObject*", "s3:PutObject", "s3:DeleteObject*"]) {
      assert.ok(actions.includes(needed), `backend lacks ${needed}: ${actions.join(", ")}`);
    }
  });

  it("can't be used by the frontend", () => {
    assert.deepEqual(statementsOf("FrontendTask").filter(touchesBucket), []);
  });

  it("is reached through the network's own S3 endpoint", () => {
    template.hasResourceProperties("AWS::EC2::VPCEndpoint", {
      VpcEndpointType: "Gateway",
      ServiceName: Match.objectLike({ "Fn::Join": Match.arrayWith([Match.arrayWith([".s3"])]) }),
    });
  });
});
