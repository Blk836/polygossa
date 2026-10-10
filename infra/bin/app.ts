import * as cdk from "aws-cdk-lib";
import { defineApp } from "../lib/app.ts";

defineApp(new cdk.App(), { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" });
