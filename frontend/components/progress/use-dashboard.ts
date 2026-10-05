"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { StatsPeriodKey } from "@/lib/progress";
import type { Dashboard } from "@/lib/types";

/** The Progress page's data for a period. The previous period's figures stay until the new ones arrive (or fail). */
export function useDashboard(period: StatsPeriodKey) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<Dashboard>(`dashboard?period=${period}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [period]);
  return { data, error };
}
