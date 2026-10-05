"use client";

import type { ComponentType, SVGProps } from "react";
import { CARD_LAYOUTS, type CardLayout } from "@/lib/card-layout";
import { useCardLayout } from "./card-layout-context";
import { GridIcon, GridSmallIcon, RowsIcon } from "./icons";

const ICONS: Record<CardLayout, ComponentType<SVGProps<SVGSVGElement>>> = {
  cards: GridIcon,
  compact: GridSmallIcon,
  list: RowsIcon,
};

/** Cards / compact / list switch for Library and Explore, like a file manager's "View" buttons; remembered on this device. */
export function CardLayoutPicker() {
  const { layout, setLayout } = useCardLayout();
  return (
    <div role="radiogroup" aria-label="Card layout" className="flex gap-1 rounded-lg border border-line bg-card p-1">
      {CARD_LAYOUTS.map(({ value, label }) => {
        const Icon = ICONS[value];
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={layout === value}
            aria-label={label}
            title={label}
            onClick={() => setLayout(value)}
            className={`rounded-md px-2 py-1.5 ${layout === value ? "bg-accent-soft text-ink" : "text-muted hover:text-ink"}`}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
    </div>
  );
}
