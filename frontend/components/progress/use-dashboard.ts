"use client";

import { useRemembered } from "../use-remembered";
import { api } from "@/lib/api";
import type { StatsPeriodKey } from "@/lib/progress";
import type { Dashboard } from "@/lib/types";

/**
 * The Progress page's data for a period: the figures last seen for it show at once while they refresh, and the
 * previous period's figures stay until the new ones arrive (or fail).
 */
export function useDashboard(period: StatsPeriodKey) {
  const { data, error } = useRemembered(`dashboard:${period}`, () => api<Dashboard>(`dashboard?period=${period}`));
  return { data, error };
}
