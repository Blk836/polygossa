import * as cdk from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import type * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";
import type { AppDatabase } from "./database.ts";

export const MONTHLY_BUDGET = 100;

export interface Watched {
  readonly frontendTargets: elbv2.ApplicationTargetGroup;
  readonly backend: ecs.FargateService;
  readonly database: AppDatabase;
}

export function monitoring(scope: Construct, email: string, watched?: Watched): void {
  if (watched) alarms(scope, email, watched);
  monthlyBudget(scope, email);
}

function alarms(scope: Construct, email: string, watched: Watched): void {
  const topic = new sns.Topic(scope, "Alerts", { displayName: "Polygossa production alerts" });
  topic.addSubscription(new subscriptions.EmailSubscription(email));
  const notify = new actions.SnsAction(topic);
  const alarm = (id: string, props: cloudwatch.AlarmProps, recovery = false) => {
    const a = new cloudwatch.Alarm(scope, id, props);
    a.addAlarmAction(notify);
    if (recovery) a.addOkAction(notify);
  };
  const minute = cdk.Duration.minutes(1);

  alarm("SiteDown", {
    alarmDescription: "The site is down: the load balancer finds no healthy frontend.",
    metric: watched.frontendTargets.metrics.healthyHostCount({ period: minute, statistic: "Minimum" }),
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    threshold: 1,
    evaluationPeriods: 2,
    treatMissingData: cloudwatch.TreatMissingData.BREACHING,
  }, true);

  alarm("BackendDown", {
    alarmDescription: "The backend is down: no backend task has reported in (crashed, or failed to start).",
    metric: watched.backend.metricCpuUtilization({ period: minute, statistic: "SampleCount" }),
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    threshold: 1,
    evaluationPeriods: 5,
    treatMissingData: cloudwatch.TreatMissingData.BREACHING,
  }, true);

  alarm("ServerErrors", {
    alarmDescription: "Server errors: the site answered 10 or more 5xx errors in 5 minutes.",
    metric: watched.frontendTargets.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    }),
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    threshold: 10,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  alarm("DatabaseCpu", {
    alarmDescription: "Database CPU has been above 80% for 15 minutes.",
    metric: watched.database.metricCPUUtilization({ period: cdk.Duration.minutes(5) }),
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    threshold: 80,
    evaluationPeriods: 3,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  alarm("DatabaseStorage", {
    alarmDescription: "Database storage is running out: under 2 GB free.",
    metric: watched.database.metricFreeStorageSpace({ period: cdk.Duration.minutes(5), statistic: "Minimum" }),
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    threshold: 2 * 1024 ** 3,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
}

function monthlyBudget(scope: Construct, email: string): void {
  const subscribers = [{ subscriptionType: "EMAIL", address: email }];
  new budgets.CfnBudget(scope, "MonthlyBudget", {
    budget: {
      budgetName: "polygossa-monthly",
      budgetType: "COST",
      timeUnit: "MONTHLY",
      budgetLimit: { amount: MONTHLY_BUDGET, unit: "USD" },
    },
    notificationsWithSubscribers: [
      {
        notification: { notificationType: "ACTUAL", comparisonOperator: "GREATER_THAN", threshold: 80, thresholdType: "PERCENTAGE" },
        subscribers,
      },
      {
        notification: { notificationType: "FORECASTED", comparisonOperator: "GREATER_THAN", threshold: 100, thresholdType: "PERCENTAGE" },
        subscribers,
      },
    ],
  });
}
