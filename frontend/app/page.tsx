import Link from "next/link";
import { cookies } from "next/headers";
import { Faq, FinalCta, Pricing } from "@/components/landing/closing";
import { Features, HowItWorks } from "@/components/landing/features";
import { Hero, LandingHeader } from "@/components/landing/hero";
import { Logo } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { signupHref } from "@/lib/landing";

/** The public home page: sells the product to new visitors and leads every path to sign-up. */
export default async function Landing() {
  const signedIn = (await cookies()).has("lector_token");
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader signedIn={signedIn} />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
          <Logo className="text-xl text-ink" />
          <nav className="flex flex-wrap gap-5" aria-label="Footer">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
          </nav>
          <p>{BRAND} · <Link href={signupHref()} className="underline">Create an account</Link></p>
        </div>
      </footer>
    </div>
  );
}
