import { EMAIL_PROVIDER_ID, passwordLoginEnabled, signIn } from "@/lib/auth";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Login - UniSin",
  description: "Sign in to manage Instagram comment-to-DM campaigns.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkEmail?: string;
    callbackUrl?: string;
    template?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params.checkEmail === "1";
  const authError = params.error;
  const selectedTemplate = getCampaignTemplate(params.template);
  const templateCallbackUrl = selectedTemplate
    ? `/campaigns/new?template=${selectedTemplate.slug}`
    : null;
  const callbackUrl = params.callbackUrl ?? templateCallbackUrl ?? "/dashboard";
  const passwordLogin = passwordLoginEnabled();

  async function sendMagicLink(formData: FormData) {
    "use server";
    await signIn(EMAIL_PROVIDER_ID, {
      email: String(formData.get("email") ?? ""),
      redirectTo: callbackUrl,
    });
  }

  async function signInWithPassword(formData: FormData) {
    "use server";
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: callbackUrl,
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            UniSin
          </h1>
          <p className="text-muted text-sm leading-relaxed mt-2">
            {selectedTemplate
              ? `Sign in to use the ${selectedTemplate.title} template.`
              : "Sign in by email, then connect your Instagram professional account."}
          </p>
        </div>

        <div className="panel rounded p-8 shadow-black/40">
          {authError && (
            <div className="mb-5 border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-red-300">
                {authError === "CredentialsSignin"
                  ? "Wrong email or password"
                  : "Could not send a magic link"}
              </p>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {authError === "CredentialsSignin"
                  ? "Use the email and password for this site."
                  : authError === "Configuration"
                  ? "Resend rejected the email. The free onboarding@resend.dev sender can only message the email on your Resend account — a second address will fail until you verify your own domain at resend.com/domains and set EMAIL_FROM to an address on that domain."
                  : "Sign-in failed. Try again, or use the same email that already works."}
              </p>
            </div>
          )}
          {selectedTemplate && !checkEmail && (
            <div className="mb-5 border border-accent/20 bg-accent/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Template selected
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {selectedTemplate.title}
              </p>
            </div>
          )}

          {passwordLogin && !checkEmail && (
            <form action={signInWithPassword} className="space-y-5 mb-6">
              <div className="space-y-2">
                <label
                  htmlFor="password-email"
                  className="block text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <input
                  id="password-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@gmail.com"
                  className="w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-indigo-500/25 transition-all hover:shadow-indigo-500/30"
              >
                Sign in
              </button>
            </form>
          )}

          {checkEmail ? (
            <div className="text-center py-4">
              <h2 className="text-lg font-semibold mb-2">Check your email</h2>
              <p className="text-sm text-muted">
                We sent you a secure sign-in link. Open it on this device to
                continue.
              </p>
            </div>
          ) : (
            <form action={sendMagicLink} className="space-y-5">
              {passwordLogin && (
                <p className="text-sm text-muted">Or send a magic link instead.</p>
              )}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-indigo-500/25 transition-all hover:shadow-indigo-500/30"
              >
                Email me a magic link
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
