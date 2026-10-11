"use client";

import { Polly } from "@/components/polly";
import { Button } from "@/components/ui";

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Polly mood="sorry" className="mx-auto mb-4 size-24" />
      <h1 className="font-display text-2xl font-semibold tracking-tight">This page couldn&apos;t load</h1>
      <p className="mt-2 text-muted">Check your connection and try again.</p>
      <Button className="mt-5" onClick={() => retry()}>Try again</Button>
    </div>
  );
}
