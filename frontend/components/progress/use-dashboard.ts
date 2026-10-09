"use client";

import { useRemembered } from "../use-remembered";
import { api } from "@/lib/api";
import type { StatsPeriodKey } from "@/lib/progress";
import type { Dashboard } from "@/lib/types";

export function useDashboard(period: StatsPeriodKey) {
  const { data, error } = useRemembered(`dashboard:${period}`, () => api<Dashboard>(`dashboard?period=${period}`));
  return { data, error };
}
