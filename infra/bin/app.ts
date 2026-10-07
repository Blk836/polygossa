// The CDK app: `npx cdk deploy PolygossaStaging` (production; the deploy job does this) or `npx cdk diff` to preview
// a change. Everything holding user data lives in Ireland (docs/production.md); the account is the one you're signed
// in to.
import * as cdk from "aws-cdk-lib";
import { defineApp } from "../lib/app.ts";

defineApp(new cdk.App(), { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" });
