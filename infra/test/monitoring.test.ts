import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ProductionStack } from "../lib/production-stack.ts";

const EMAIL = "owner@example.com";
let template: Template;

before(() => {
  const app = new cdk.App();
  const stack = new ProductionStack(app, "Production", {
    env: { account: "111111111111", region: "eu-west-1" },
    cloudFrontPrefixListId: "pl-cloudfront",
    alertEmail: EMAIL,
  });
  template = Template.fromStack(stack);
});

function alarm(start: string): Record<string, unknown> {
  const found = Object.values(template.findResources("AWS::CloudWatch::Alarm"))
    .map((a) => a.Properties as Record<string, unknown>)
    .filter((p) => String(p.AlarmDescription).startsWith(start));
  assert.equal(found.length, 1, `one alarm "${start}…"`);
  return found[0];
}

const topicId = () => Object.keys(template.findResources("AWS::SNS::Topic"))[0];
const notifiesOwner = (a: Record<string, unknown>) =>
  JSON.stringify(a.AlarmActions).includes(topicId()) ;

describe("monitoring", () => {
  it("emails one alert topic to the owner", () => {
    template.resourceCountIs("AWS::SNS::Topic", 1);
    template.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email", Endpoint: EMAIL });
  });

  it("says when the site is down: no healthy frontend for 2 minutes, and when it is back", () => {
    const a = alarm("The site is down");
    assert.equal(a.MetricName, "HealthyHostCount");
    assert.equal(a.Namespace, "AWS/ApplicationELB");
    assert.equal(a.ComparisonOperator, "LessThanThreshold");
    assert.equal(a.Threshold, 1);
    assert.equal(a.EvaluationPeriods, 2);
    assert.equal(a.Period, 60);
    assert.equal(a.TreatMissingData, "breaching");
    assert.ok(notifiesOwner(a));
    assert.ok(JSON.stringify(a.OKActions).includes(topicId()));
  });

  it("says when the backend is down: no task reporting for 5 minutes, silence being the failure", () => {
    const a = alarm("The backend is down");
    assert.equal(a.MetricName, "CPUUtilization");
    assert.equal(a.Namespace, "AWS/ECS");
    assert.equal(a.Statistic, "SampleCount");
    assert.equal(a.ComparisonOperator, "LessThanThreshold");
    assert.equal(a.Threshold, 1);
    assert.equal(a.EvaluationPeriods, 5);
    assert.equal(a.TreatMissingData, "breaching");
    assert.match(JSON.stringify(a.Dimensions), /BackendService/);
    assert.ok(notifiesOwner(a));
  });

  it("says when server errors rise: 10 or more 5xx in 5 minutes", () => {
    const a = alarm("Server errors");
    assert.equal(a.MetricName, "HTTPCode_Target_5XX_Count");
    assert.equal(a.Statistic, "Sum");
    assert.equal(a.Period, 300);
    assert.equal(a.Threshold, 10);
    assert.equal(a.ComparisonOperator, "GreaterThanOrEqualToThreshold");
    assert.equal(a.TreatMissingData, "notBreaching");
    assert.ok(notifiesOwner(a));
  });

  it("says when the database is under strain: CPU over 80% for 15 minutes, or under 2 GB free", () => {
    const cpu = alarm("Database CPU");
    assert.equal(cpu.Namespace, "AWS/RDS");
    assert.equal(cpu.MetricName, "CPUUtilization");
    assert.equal(cpu.Threshold, 80);
    assert.equal(Number(cpu.Period) * Number(cpu.EvaluationPeriods), 900);
    const storage = alarm("Database storage");
    assert.equal(storage.MetricName, "FreeStorageSpace");
    assert.equal(storage.Threshold, 2 * 1024 ** 3);
    assert.equal(storage.ComparisonOperator, "LessThanThreshold");
    assert.ok(notifiesOwner(cpu) && notifiesOwner(storage));
  });

  it("watches the monthly bill: $100, emailing at 80% actual and 100% forecast", () => {
    template.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({ BudgetType: "COST", TimeUnit: "MONTHLY", BudgetLimit: { Amount: 100, Unit: "USD" } }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: { NotificationType: "ACTUAL", ComparisonOperator: "GREATER_THAN", Threshold: 80, ThresholdType: "PERCENTAGE" },
          Subscribers: [{ SubscriptionType: "EMAIL", Address: EMAIL }],
        }),
        Match.objectLike({
          Notification: { NotificationType: "FORECASTED", ComparisonOperator: "GREATER_THAN", Threshold: 100, ThresholdType: "PERCENTAGE" },
          Subscribers: [{ SubscriptionType: "EMAIL", Address: EMAIL }],
        }),
      ]),
    });
  });
});
