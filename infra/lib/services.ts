import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

export const NAMESPACE = "polygossa.internal";
export const BACKEND_NAME = "backend";

export function appLogs(scope: Construct, name: string): ecs.LogDriver {
  return ecs.LogDrivers.awsLogs({
    streamPrefix: name,
    logGroup: new logs.LogGroup(scope, `${name}Logs`, { retention: logs.RetentionDays.ONE_MONTH }),
  });
}
