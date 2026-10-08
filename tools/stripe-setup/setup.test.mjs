// docs/acceptance/stripe-billing.feature: the one-time Stripe setup (prices and the webhook), against a fake Stripe.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRICES, setUp } from "./setup.mjs";

/** A fake Stripe: remembers prices and webhook endpoints, records every call. */
function fakeStripe({ prices = [], endpoints = [] } = {}) {
  const calls = [];
  const routes = {
    "GET /v1/prices": (u) => ({ data: prices.filter((p) => u.searchParams.getAll("lookup_keys[]").includes(p.lookup_key)) }),
    "POST /v1/prices": (u, body) => {
      prices.push({ id: `price_${body.lookup_key}`, lookup_key: body.lookup_key });
      return prices.at(-1);
    },
    "GET /v1/webhook_endpoints": () => ({ data: endpoints }),
    "POST /v1/webhook_endpoints": (u, body) => ({ id: "we_new", url: body.url, secret: "whsec_from_stripe" }),
    "DELETE /v1/webhook_endpoints": (u) => ({ id: u.pathname.split("/").at(-1), deleted: true }),
  };
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = Object.fromEntries(new URLSearchParams(init.body ?? ""));
    calls.push({ method, path: u.pathname, body, auth: init.headers?.Authorization });
    const route = routes[`${method} ${u.pathname.replace(/\/we_\w+$/, "")}`];
    return route ? new Response(JSON.stringify(route(u, body))) : new Response("{}", { status: 404 });
  };
  return { fetch, calls };
}

const site = "https://site.example";

describe("stripe setup", () => {
  it("creates the three prices in euros, VAT included, found by their lookup keys", async () => {
    const stripe = fakeStripe();
    const saved = [];
    await setUp({ key: "sk_test_x", site, fetch: stripe.fetch, saveWebhookSecret: async (s) => saved.push(s), print() {} });

    const created = stripe.calls.filter((c) => c.method === "POST" && c.path === "/v1/prices").map((c) => c.body);
    assert.deepEqual(created.map((p) => [p.lookup_key, p.unit_amount, p["recurring[interval]"]]), [
      ["pro_monthly", "800", "month"],
      ["pro_yearly", "6000", "year"],
      ["classroom_monthly", "400", "month"],
    ]);
    for (const p of created) {
      assert.equal(p.currency, "eur");
      assert.equal(p.tax_behavior, "inclusive");
    }
    assert.deepEqual(PRICES.map((p) => p.lookupKey), ["pro_monthly", "pro_yearly", "classroom_monthly"]);
    assert.ok(stripe.calls.every((c) => c.auth === "Bearer sk_test_x"));
  });

  it("registers the webhook for subscription events at the site, and saves its signing secret without printing it", async () => {
    const stripe = fakeStripe();
    const saved = [];
    const printed = [];
    await setUp({ key: "sk_test_x", site, fetch: stripe.fetch, saveWebhookSecret: async (s) => saved.push(s),
      print: (line) => printed.push(line) });

    const hook = stripe.calls.find((c) => c.method === "POST" && c.path === "/v1/webhook_endpoints").body;
    assert.equal(hook.url, `${site}/api/billing/webhook`);
    assert.deepEqual(Object.entries(hook).filter(([k]) => k.startsWith("enabled_events")).map(([, v]) => v),
      ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);
    assert.equal(hook.api_version, "2026-09-30.endive");
    assert.deepEqual(saved, ["whsec_from_stripe"]);
    assert.ok(printed.every((line) => !line.includes("whsec_")));
  });

  it("is safe to run again: existing prices are kept, and an old webhook at that address is replaced", async () => {
    const stripe = fakeStripe({
      prices: PRICES.map((p) => ({ id: `price_old_${p.lookupKey}`, lookup_key: p.lookupKey })),
      endpoints: [{ id: "we_old", url: `${site}/api/billing/webhook` }, { id: "we_other", url: "https://elsewhere/hook" }],
    });
    await setUp({ key: "sk_test_x", site, fetch: stripe.fetch, saveWebhookSecret: async () => {}, print() {} });

    assert.equal(stripe.calls.filter((c) => c.method === "POST" && c.path === "/v1/prices").length, 0);
    assert.deepEqual(stripe.calls.filter((c) => c.method === "DELETE").map((c) => c.path), ["/v1/webhook_endpoints/we_old"]);
  });

  it("refuses a live key unless asked, and anything that isn't a secret key", async () => {
    const stripe = fakeStripe();
    const args = { site, fetch: stripe.fetch, saveWebhookSecret: async () => {}, print() {} };
    await assert.rejects(setUp({ ...args, key: "sk_live_x" }), /live/);
    await assert.rejects(setUp({ ...args, key: "pk_test_x" }), /secret key/);
    assert.equal(stripe.calls.length, 0);
  });
});
