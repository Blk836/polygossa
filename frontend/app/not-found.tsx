import { Polly } from "@/components/polly";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <Polly mood="sorry" className="mx-auto mb-4 size-24" />
      <h1 className="font-display text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted">There&apos;s nothing at this address.</p>
      <LinkButton href="/" className="mt-5">Go home</LinkButton>
    </main>
  );
}
