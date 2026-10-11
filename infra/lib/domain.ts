import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";

export interface SiteDomain {
  readonly names: string[];
  readonly certificate: acm.ICertificate;
  readonly redirect: cloudfront.FunctionAssociation;
  pointAt(distribution: cloudfront.IDistribution): void;
}

export function redirectSource(domain: string): string {
  return [
    "function handler(event) {",
    "  var request = event.request;",
    "  var host = request.headers.host ? request.headers.host.value : '';",
    `  if (host === '${domain}') return request;`,
    "  var parts = [];",
    "  for (var key in request.querystring) {",
    "    var field = request.querystring[key];",
    "    var values = field.multiValue || [field];",
    "    for (var i = 0; i < values.length; i++) parts.push(key + '=' + values[i].value);",
    "  }",
    "  var query = parts.length ? '?' + parts.join('&') : '';",
    "  return {",
    "    statusCode: 301,",
    "    statusDescription: 'Moved Permanently',",
    `    headers: { location: { value: 'https://${domain}' + request.uri + query } },`,
    "  };",
    "}",
  ].join("\n");
}

export function hostedZone(scope: Construct, domain: string): route53.IHostedZone {
  const zone = new route53.PublicHostedZone(scope, "Zone", { zoneName: domain });
  zone.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
  new cdk.CfnOutput(scope, "NameServers", {
    value: cdk.Fn.join(",", zone.hostedZoneNameServers!),
    description: "Set these at the registrar (Namecheap: Custom DNS)",
  });
  return zone;
}

export function siteDomain(scope: Construct, zone: route53.IHostedZone, domain: string): SiteDomain {
  const www = `www.${domain}`;
  const certificate = new acm.DnsValidatedCertificate(scope, "SiteCertificate", {
    domainName: domain,
    subjectAlternativeNames: [www],
    hostedZone: zone,
    region: "us-east-1",
  });
  const redirect = new cloudfront.Function(scope, "ToDomain", {
    code: cloudfront.FunctionCode.fromInline(redirectSource(domain)),
    runtime: cloudfront.FunctionRuntime.JS_2_0,
    comment: `Sends every other host name to ${domain}`,
  });
  return {
    names: [domain, www],
    certificate,
    redirect: { function: redirect, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
    pointAt(distribution) {
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      for (const [id, name] of [["Apex", domain], ["Www", www]]) {
        new route53.ARecord(scope, `${id}A`, { zone, recordName: name, target });
        new route53.AaaaRecord(scope, `${id}Aaaa`, { zone, recordName: name, target });
      }
    },
  };
}
