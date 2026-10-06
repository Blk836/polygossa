"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "./avatar";
import { useMe } from "./me-context";
import { useDismiss } from "./use-dismiss";
import { isUnder } from "@/lib/nav";
import { initialOf } from "@/lib/photo";
import type { Tier } from "@/lib/types";

/** The backend's development test account (see proxy.ts). */
const AUTO_LOGIN_EMAIL = "test@lector.local";

const PLAN_NAMES: Record<Tier, string> = { FREE: "Free", PRO: "Pro", CLASSROOM: "Classroom" };

const ITEMS = [
  { href: "/settings", label: "Settings" },
  { href: "/classes", label: "Classes" },
  { href: "/forum", label: "Forum" },
];

const itemClass = "block w-full px-3 py-2 text-left text-sm hover:bg-paper focus:bg-paper focus:outline-none";

/** Arrow keys move between the menu's items, wrapping around. */
function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"));
  const at = items.indexOf(document.activeElement as HTMLElement);
  const step = e.key === "ArrowDown" ? 1 : -1;
  items[(at + step + items.length) % items.length]?.focus();
}

/** The avatar menu: who's signed in, their plan, Settings, Classes, the Forum and signing out. */
export function AccountMenu() {
  const { me } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const refocus = useCallback(() => button.current?.focus(), []);
  useDismiss(open, close, root, refocus);

  const here = ITEMS.some((i) => isUnder(pathname, i.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-current={here ? "page" : undefined}
        className={`grid size-8 place-items-center overflow-hidden rounded-full border text-sm font-semibold transition ${
          here || open ? "border-rubric bg-accent-soft" : "border-line bg-card hover:border-accent/50"
        }`}
      >
        {me.photoUrl ? <Avatar name={me.displayName || me.email} photoUrl={me.photoUrl} size="md" /> : <span aria-hidden>{initialOf(me.displayName, me.email)}</span>}
      </button>
      {open && (
        <div role="menu" aria-label="Account" onKeyDown={moveFocus} className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg">
          <div className="border-b border-line px-3 pt-2 pb-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={me.displayName || me.email} photoUrl={me.photoUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{me.displayName}</p>
                <p className="truncate text-xs text-muted">{me.email}</p>
              </div>
            </div>
            <p data-testid="account-plan" className="mt-2 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold">
              {PLAN_NAMES[me.plan.effectiveTier]} plan
            </p>
          </div>
          {ITEMS.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" onClick={close} className={itemClass}>
              {item.label}
            </Link>
          ))}
          {/* The auto-login test account would just be signed straight back in. */}
          {me.email !== AUTO_LOGIN_EMAIL && (
            <button type="button" role="menuitem" onClick={() => void logout()} className={`${itemClass} border-t border-line text-muted`}>
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
