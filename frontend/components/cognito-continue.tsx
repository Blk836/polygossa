import { ErrorNote, buttonClass } from "./ui";

/** Errors the sign-in return (app/api/auth/callback) can send back to the sign-in page. */
const ERRORS: Record<string, string> = {
  failed: "Sign-in didn't complete. Please try again.",
  suspended: "This account is suspended. Contact the team if you think this is a mistake.",
  unavailable: "The server is unavailable. Try again shortly.",
};

/** With Cognito, the sign-in and sign-up pages send people on to Cognito's hosted page instead of showing a form. */
export function CognitoContinue({ screen, next, error }: { screen: "login" | "signup"; next?: string; error?: string }) {
  const params = new URLSearchParams({ screen });
  if (next) params.set("next", next);
  return (
    <div className="space-y-4">
      <ErrorNote message={error ? (ERRORS[error] ?? ERRORS.failed) : null} />
      {/* A plain link: the route redirects to Cognito, which a client-side navigation can't follow. */}
      <a href={`/api/auth/cognito/start?${params}`} className={`${buttonClass()} w-full`}>
        {screen === "signup" ? "Create your account" : "Sign in"}
      </a>
      <p className="text-center text-sm text-muted">
        {screen === "signup"
          ? <>Already have an account? <a href="/login" className="text-ink underline">Sign in</a></>
          : <>New here? <a href="/signup" className="text-ink underline">Create an account</a></>}
      </p>
    </div>
  );
}
