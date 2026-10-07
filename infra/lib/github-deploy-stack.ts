import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

export interface GitHubDeployProps extends cdk.StackProps {
  /** "owner/name" of the repository allowed to deploy. */
  readonly repository: string;
  /**
   * How GitHub's OIDC tokens name that repository: "repo:owner@ownerId/name@repoId", with the immutable IDs (so a
   * renamed or re-created repository with the same name can't deploy).
   */
  readonly subject: string;
}

const GITHUB_TOKENS = "token.actions.githubusercontent.com";

/**
 * Lets GitHub Actions deploy without stored keys: a workflow on the repository's main branch exchanges its OIDC token for
 * short-lived credentials of this role, which may only assume CDK's own bootstrap roles (the ones `cdk deploy` uses to
 * publish images and run CloudFormation). Deployed once by hand; afterwards every deploy goes through it.
 */
export class GitHubDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GitHubDeployProps) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, "GitHub", {
      url: `https://${GITHUB_TOKENS}`,
      clientIds: ["sts.amazonaws.com"],
    });

    const role = new iam.Role(this, "DeployRole", {
      roleName: "polygossa-github-deploy",
      description: `GitHub Actions on ${props.repository} (main only) deploying with CDK`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          [`${GITHUB_TOKENS}:aud`]: "sts.amazonaws.com",
          [`${GITHUB_TOKENS}:sub`]: `${props.subject}:ref:refs/heads/main`,
        },
      }),
    });
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["sts:AssumeRole"],
      resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-*`],
    }));
    // The deploy job reads the stack's outputs (the site URL) to check the site afterwards.
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["cloudformation:DescribeStacks"],
      resources: [`arn:aws:cloudformation:*:${this.account}:stack/Polygossa*/*`],
    }));

    new cdk.CfnOutput(this, "DeployRoleArn", { value: role.roleArn, description: "Set as the AWS_DEPLOY_ROLE_ARN variable" });
  }
}
