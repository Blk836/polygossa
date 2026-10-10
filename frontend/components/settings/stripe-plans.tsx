"use client";

import { useState } from "react";
import { Button, ErrorNote } from "../ui";
import { api, errorMessage } from "@/lib/api";
import type { Billing, Me } from "@/lib/types";

const PRO_PRICES = [
  { plan: "pro_monthly", label: "€8 a month" },
  { plan: "pro_yearly", label: "€60 a year" },
];
const CLASSROOM_PRICE = { plan: "classroom_monthly", label: "€4 per student a month" };

const CARDS = [
  { key: "free", name: "Free", price: "€0", items: ["5 imported texts", "500 saved words", "Basic dictionary"] },
  { key: "pro", name: "Pro", price: "€8/mo or €60/yr", items: ["Unlimited texts & words", "Spaced repetition review", "Audio sync", "AI definitions, examples & writing tutor"] },
  { key: "classroom", name: "Classroom", price: "€4/student/mo", items: ["All Pro features", "Create classes & assign texts", "Student progress", "Pro access for your students"] },
];

const PRICES: Record<string, { plan: string; label: string }[]> = {
  free: [],
  pro: PRO_PRICES,
  classroom: [CLASSROOM_PRICE],
};

function PlanCard({ card, current, prices, busy, onBuy }: {
  card: (typeof CARDS)[number];
  current: boolean;
  prices: { plan: string; label: string }[];
  busy: boolean;
  onBuy: (plan: string) => void;
}) {
  return (
    <div data-testid="plan-card" className={`flex flex-col rounded-xl border bg-card p-4 ${current ? "border-accent" : "border-line"}`}>
      <p className="font-semibold">{card.name}</p>
      <p className="text-sm text-muted">{card.price}</p>
      <ul className="mt-3 flex-1 space-y-1 text-sm">
        {card.items.map((i) => <li key={i}>✓ {i}</li>)}
      </ul>
      {current && <p className="mt-4 text-sm font-medium">Current plan</p>}
      {prices.map((p) => (
        <Button key={p.plan} className="mt-3" disabled={busy} onClick={() => onBuy(p.plan)}>{p.label}</Button>
      ))}
    </div>
  );
}

const planName = (plan: string) => (plan.startsWith("classroom") ? "Classroom" : "Pro");

export function billingDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

async function goTo(path: string, body: Record<string, unknown>) {
  const { url } = await api<{ url: string }>(path, { body });
  window.location.assign(url);
}

function StatusLine({ billing }: { billing: Billing }) {
  if (!billing.plan) return null;
  const name = planName(billing.plan);
  const end = billing.periodEnd ? billingDate(billing.periodEnd) : null;
  return (
    <p className="mt-1 text-sm">
      You&apos;re on {name}, billed {billing.interval === "year" ? "yearly" : "monthly"}.
      {end && (billing.cancelAtPeriodEnd ? ` ${name} ends on ${end}.` : ` Renews on ${end}.`)}
    </p>
  );
}

export function StripePlans({ billing, me }: { billing: Billing; me: Me }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(path: string, body: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      await goTo(path, body);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const buy = (plan: string) => void run("billing/checkout", { plan });
  const manage = () => void run("billing/portal", {});
  const subscribed = billing.plan !== null;

  return (
    <>
      <StatusLine billing={billing} />
      {billing.paymentProblem && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          <span>Your last payment didn&apos;t go through. Stripe will try again; update your card to keep {planName(billing.plan ?? "pro")}.</span>
          <Button variant="secondary" disabled={busy} onClick={manage}>Update card</Button>
        </div>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {CARDS.map((c) => {
          const current = c.key === "free" ? !subscribed && me.plan.tier === "FREE" : billing.plan?.startsWith(c.key) ?? false;
          return (
            <PlanCard key={c.key} card={c} current={current} prices={current || subscribed ? [] : PRICES[c.key]}
              busy={busy} onBuy={buy} />
          );
        })}
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
      {subscribed && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={busy} onClick={manage}>Manage subscription</Button>
          <span className="text-sm text-muted">Change card, switch plans, see invoices or cancel, on Stripe.</span>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Prices include VAT. Payments are handled by Stripe.
        {billing.testMode && " Test mode: only Stripe's test cards work (such as 4242 4242 4242 4242); no real money is taken."}
      </p>
    </>
  );
}
