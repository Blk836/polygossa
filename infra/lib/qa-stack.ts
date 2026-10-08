import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import { userPool } from "./login.ts";

export interface QaProps extends cdk.StackProps {
  /** The owner's Google OAuth client (cdk.json's `google-client-id`); one client serves both pools. */
  readonly googleClientId?: string;
}

/**
 * The QA resources: local runs (the QA environment) sign in through this user pool, kept apart from production's so
 * local accounts never mix with real ones. Its database stays in Docker on the developer's machine.
 */
export class QaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: QaProps = {}) {
    super(scope, id, props);
    const login = userPool(this, {
      domainPrefix: "polygossa-qa",
      siteUrl: "http://localhost:3000",
      keep: false,
      googleClientId: props.googleClientId ?? "unset.apps.googleusercontent.com",
    });
    new cdk.CfnOutput(this, "CognitoIssuer", { value: login.issuer, description: "COGNITO_ISSUER (backend)" });
    new cdk.CfnOutput(this, "CognitoClientId", { value: login.clientId, description: "COGNITO_CLIENT_ID" });
    new cdk.CfnOutput(this, "CognitoDomain", { value: login.domain, description: "COGNITO_DOMAIN (frontend)" });
  }
}
