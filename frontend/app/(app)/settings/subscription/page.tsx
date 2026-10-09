"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/components/me-context";
import { StripePlans } from "@/components/settings/stripe-plans";
import { Button, ErrorNote } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Billing, Me, Tier } from "@/lib/types";

const PLANS: { tier: Tier; name: string; price: string; items: string[] }[] = [
  { tier: "FREE", name: "Free", price: "€0", items: ["5 imported texts", "500 saved words", "Basic dictionary"] },
  { tier: "PRO", name: "Pro", price: "€8/mo or €60/yr", items: ["Unlimited texts & words", "Spaced repetition review", "Audio sync", "AI definitions, examples & writing tutor"] },
  { tier: "CLASSROOM", name: "Classroom", price: "€4/student/mo", items: ["All Pro features", "Create classes & assign texts", "Student progress", "Pro access for your students"] },
];

const CONFIRM_EVERY_MS = 2000;
const CONFIRM_FOR_MS = 30000;

function DemoPlans() {
  const { me, setMe } = useMe();
  const [error, setError] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);

  async function choosePlan(tier: Tier) {
    setError(null);
    setPlanBusy(true);
    try {
      setMe(await api<Me>("me/plan", { body: { tier } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {PLANS.map((p) => {
          const current = me.plan.tier === p.tier;
          return (
            <div key={p.tier} data-testid="plan-card" className={`flex flex-col rounded-xl border bg-card p-4 ${current ? "border-accent" : "border-line"}`}>
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-muted">{p.price}</p>
              <ul className="mt-3 flex-1 space-y-1 text-sm">
                {p.items.map((i) => <li key={i}>✓ {i}</li>)}
              </ul>
              <Button className="mt-4" variant={current ? "secondary" : "primary"} disabled={current || planBusy} onClick={() => choosePlan(p.tier)}>
                {current ? "Current plan" : p.tier === "FREE" ? "Downgrade" : `Switch to ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
      <p className="mt-2 text-xs text-muted">
        Demo billing: plan changes apply immediately. In production this button would open the payment provider&apos;s checkout.
      </p>
    </>
  );
}

export default function SubscriptionPage() {
  const { me, setMe } = useMe();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [confirming, setConfirming] = useState<"waiting" | "slow" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const back = new URLSearchParams(window.location.search).get("checkout") === "success";
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      api<Billing>("billing").then((b) => {
        if (cancelled) return;
        setBilling(b);
        const done = !back || !b.enabled || b.plan !== null;
        if (done) {
          setConfirming(null);
          if (back) void api<Me>("me").then((m) => { if (!cancelled) setMe(m); });
          return;
        }
        setConfirming(Date.now() - started > CONFIRM_FOR_MS ? "slow" : "waiting");
        timer = setTimeout(check, CONFIRM_EVERY_MS);
      }).catch(() => {
        if (!cancelled) setBilling({ enabled: false, testMode: false, plan: null, interval: null, status: null,
          periodEnd: null, cancelAtPeriodEnd: false, paymentProblem: false });
      });
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setMe]);

  return (
    <section aria-labelledby="plan-heading">
      <h2 id="plan-heading" className="font-display text-lg font-semibold">Plan</h2>
      {me.plan.sponsoredByClassroom && (
        <p className="mt-1 text-sm text-muted">You have Pro features through your teacher&apos;s Classroom plan.</p>
      )}
      {confirming && (
        <p className="mt-2 rounded-lg border border-line bg-card px-3 py-2 text-sm">
          {confirming === "waiting"
            ? "Confirming your payment with Stripe…"
            : "Confirming your payment is taking longer than usual. Refresh this page in a minute."}
        </p>
      )}
      {billing?.enabled ? <StripePlans billing={billing} me={me} /> : billing && <DemoPlans />}
      {me.plan.limits.texts !== null && (
        <p className="mt-2 text-sm text-muted">
          Usage: {me.plan.usage.texts}/{me.plan.limits.texts} texts · {me.plan.usage.savedWords}/{me.plan.limits.savedWords} saved words
        </p>
      )}
    </section>
  );
}
