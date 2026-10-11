export const DEFAULT_SITE = "https://polygossa.com";

export const PRICES = [
  { lookupKey: "pro_monthly", product: "Pro", amount: 800, interval: "month" },
  { lookupKey: "pro_yearly", product: "Pro", amount: 6000, interval: "year" },
  { lookupKey: "classroom_monthly", product: "Classroom (per student)", amount: 400, interval: "month" },
];

const EVENTS = ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
const API_VERSION = "2026-09-30.endive";
const API = "https://api.stripe.com";

function client(key, fetch) {
  return async (method, path, fields) => {
    const body = fields ? new URLSearchParams(fields).toString() : undefined;
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Stripe ${method} ${path} failed: ${data.error?.message ?? res.status}`);
    return data;
  };
}

function checkKey(key, allowLive) {
  if (!/^(sk|rk)_(test|live)_/.test(key ?? "")) throw new Error("STRIPE_SECRET_KEY must be a Stripe secret key (sk_test_…)");
  if (key.includes("_live_") && !allowLive) throw new Error("That's a live key: pass --live to set up live mode on purpose");
}

async function ensurePrices(stripe, print) {
  const query = PRICES.map((p) => `lookup_keys[]=${encodeURIComponent(p.lookupKey)}`).join("&");
  const existing = new Set((await stripe("GET", `/v1/prices?active=true&${query}`)).data.map((p) => p.lookup_key));
  for (const p of PRICES) {
    if (existing.has(p.lookupKey)) {
      print(`Price ${p.lookupKey}: already there`);
      continue;
    }
    await stripe("POST", "/v1/prices", {
      lookup_key: p.lookupKey,
      currency: "eur",
      unit_amount: String(p.amount),
      tax_behavior: "inclusive",
      "recurring[interval]": p.interval,
      "product_data[name]": p.product,
    });
    print(`Price ${p.lookupKey}: created (€${p.amount / 100} a ${p.interval}, VAT included)`);
  }
}

async function ensureWebhook(stripe, url, saveWebhookSecret, print) {
  for (const old of (await stripe("GET", "/v1/webhook_endpoints?limit=100")).data.filter((e) => e.url === url)) {
    await stripe("DELETE", `/v1/webhook_endpoints/${old.id}`);
    print(`Webhook ${old.id}: replaced`);
  }
  const fields = { url, api_version: API_VERSION };
  EVENTS.forEach((e, i) => { fields[`enabled_events[${i}]`] = e; });
  const hook = await stripe("POST", "/v1/webhook_endpoints", fields);
  await saveWebhookSecret(hook.secret);
  print(`Webhook ${hook.id}: created at ${url}; its signing secret is saved (not shown)`);
}

export async function setUp({ key, site, fetch, saveWebhookSecret, print, allowLive = false }) {
  checkKey(key, allowLive);
  const stripe = client(key, fetch);
  await ensurePrices(stripe, print);
  await ensureWebhook(stripe, `${site.replace(/\/+$/, "")}/api/billing/webhook`, saveWebhookSecret, print);
}
