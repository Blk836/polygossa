import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { defineApp } from "../lib/app.ts";
import { redirectSource } from "../lib/domain.ts";

const OLD_SITE = "https://old.cloudfront.example";
const DOMAIN = "polygossa.com";

function production(context: Record<string, unknown>): Template {
  const app = new cdk.App({
    context: { "github-repo": "owner/repo", "github-subject": "repo:owner/repo", "site-url": OLD_SITE, ...context },
  });
  return Template.fromStack(defineApp(app, { account: "111111111111", region: "eu-west-1" }, "pl-cloudfront").production);
}

function container(template: Template, name: string): Record<string, unknown> {
  for (const task of Object.values(template.findResources("AWS::ECS::TaskDefinition"))) {
    const found = (task.Properties.ContainerDefinitions as Record<string, unknown>[]).find((c) => c.Name === name);
    if (found) return found;
  }
  throw new Error(`no container ${name}`);
}

const appUrl = (template: Template, name: string) =>
  (container(template, name).Environment as { Name: string; Value: unknown }[]).find((e) => e.Name === "APP_URL")?.Value;

const siteUrlOutput = (template: Template) => template.findOutputs("SiteUrl").SiteUrl.Value;

const certificates = (template: Template) =>
  Object.values(template.findResources("AWS::CloudFormation::CustomResource"))
    .filter((r) => r.Properties.DomainName !== undefined);

type Request = { uri: string; headers: Record<string, { value: string }>; querystring: Record<string, unknown> };
const redirect = new Function(`${redirectSource(DOMAIN)}; return handler;`)() as
  (event: { request: Request }) => Request | { statusCode: number; headers: { location: { value: string } } };

const viewer = (host: string, uri: string, querystring: Record<string, unknown> = {}) =>
  redirect({ request: { uri, headers: { host: { value: host } }, querystring } });

describe("stage 1: AWS answers for the domain", () => {
  const template = production({ domain: DOMAIN });

  it("has a public hosted zone for the domain, kept if the stack is deleted", () => {
    template.hasResource("AWS::Route53::HostedZone", {
      Properties: Match.objectLike({ Name: `${DOMAIN}.`, VpcConfigs: Match.absent() }),
      DeletionPolicy: "Retain",
    });
  });

  it("outputs the zone's nameservers for the registrar", () => {
    const value = JSON.stringify(template.findOutputs("NameServers").NameServers.Value);
    assert.match(value, /NameServers/);
  });

  it("changes nothing for learners: same address, same sign-in returns, no certificate or aliases", () => {
    assert.equal(siteUrlOutput(template).toString().includes(DOMAIN), false);
    assert.equal(appUrl(template, "backend"), OLD_SITE);
    assert.equal(appUrl(template, "frontend"), OLD_SITE);
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      CallbackURLs: [`${OLD_SITE}/api/auth/callback`],
      LogoutURLs: [`${OLD_SITE}/`],
    });
    assert.equal(certificates(template).length, 0);
    template.resourceCountIs("AWS::Route53::RecordSet", 0);
    template.resourceCountIs("AWS::CloudFront::Function", 0);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({ Aliases: Match.absent() }),
    });
  });
});

describe("stage 2: the site moves to the domain", () => {
  const template = production({ domain: DOMAIN, "domain-live": true });

  it("has a DNS-validated certificate in us-east-1 for the domain and www, made from this stack", () => {
    const found = certificates(template);
    assert.equal(found.length, 1);
    assert.equal(found[0].Properties.DomainName, DOMAIN);
    assert.deepEqual(found[0].Properties.SubjectAlternativeNames, [`www.${DOMAIN}`]);
    assert.equal(found[0].Properties.Region, "us-east-1");
  });

  it("serves the domain and www from the distribution with that certificate", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: [DOMAIN, `www.${DOMAIN}`],
        ViewerCertificate: Match.objectLike({ SslSupportMethod: "sni-only" }),
      }),
    });
  });

  it("points A and AAAA records for the domain and www at the distribution", () => {
    for (const type of ["A", "AAAA"]) {
      for (const name of [`${DOMAIN}.`, `www.${DOMAIN}.`]) {
        template.hasResourceProperties("AWS::Route53::RecordSet", {
          Name: name,
          Type: type,
          AliasTarget: Match.objectLike({ DNSName: Match.anyValue() }),
        });
      }
    }
  });

  it("runs the redirect on every viewer request", () => {
    template.hasResourceProperties("AWS::CloudFront::Function", {
      FunctionCode: redirectSource(DOMAIN),
      FunctionConfig: Match.objectLike({ Runtime: "cloudfront-js-2.0" }),
    });
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: [Match.objectLike({ EventType: "viewer-request" })],
        }),
      }),
    });
  });

  it("builds the app's links with the domain and reports it as the site", () => {
    assert.equal(appUrl(template, "backend"), `https://${DOMAIN}`);
    assert.equal(appUrl(template, "frontend"), `https://${DOMAIN}`);
    assert.equal(siteUrlOutput(template), `https://${DOMAIN}`);
  });

  it("returns sign-in and sign-out to the domain, still accepting the old address", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      CallbackURLs: [`https://${DOMAIN}/api/auth/callback`, `${OLD_SITE}/api/auth/callback`],
      LogoutURLs: [`https://${DOMAIN}/`, `${OLD_SITE}/`],
    });
  });
});

describe("production's settings", () => {
  it("run the site on polygossa.com", () => {
    const { context } = JSON.parse(readFileSync(new URL("../cdk.json", import.meta.url), "utf8"));
    assert.equal(context.domain, DOMAIN);
    assert.equal(context["domain-live"], true);
  });
});

describe("the redirect to the domain", () => {
  it("sends www to the bare domain, keeping the path and query", () => {
    const answer = viewer(`www.${DOMAIN}`, "/library", { tab: { value: "books" } });
    assert.deepEqual(answer, {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: { location: { value: `https://${DOMAIN}/library?tab=books` } },
    });
  });

  it("sends the old cloudfront.net address to the domain, keeping the path and every query value as sent", () => {
    const answer = viewer("d3pd9mue4v7won.cloudfront.net", "/reader/42", {
      page: { value: "3" },
      tag: { value: "a", multiValue: [{ value: "a" }, { value: "b" }] },
      q: { value: "a%20b%26c" },
    });
    assert.equal("statusCode" in answer && answer.statusCode, 301);
    assert.equal("headers" in answer && answer.headers.location.value,
      `https://${DOMAIN}/reader/42?page=3&tag=a&tag=b&q=a%20b%26c`);
  });

  it("adds no question mark when there is no query", () => {
    const answer = viewer(`www.${DOMAIN}`, "/");
    assert.equal("headers" in answer && answer.headers.location.value, `https://${DOMAIN}/`);
  });

  it("lets requests for the domain itself through untouched", () => {
    const request = { uri: "/", headers: { host: { value: DOMAIN } }, querystring: {} };
    assert.equal(redirect({ request }), request);
  });
});
