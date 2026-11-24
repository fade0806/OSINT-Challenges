import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [{ title: "Sign in · OSINT | SentinalsPrime" }] }),
});

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "up") {
        const { error: signUpError } = await authClient.signUp.email({
          name: name.trim() || "Operator",
          email: email.trim(),
          password,
          callbackURL: "/admin",
        });
        if (signUpError) throw new Error(signUpError.message ?? "Could not create the account.");
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/admin",
        });
        if (signInError) throw new Error(signInError.message ?? "Could not sign in.");
      }
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setPending(false);
    }
  }

  return (
    <SiteShell>
      <h1 className="sp-page-title">Operator</h1>
      <p className="sp-lede">
        The board is public. Publishing a challenge requires a signed-in operator.
      </p>
      <div className="sp-auth-card">
        {authEnabled ? (
          <>
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                className="sp-button"
                onClick={() => signIn(provider.providerId, { callbackURL: "/admin" })}
              >
                Continue with {provider.label}
              </button>
            ))}
            <p className="sp-auth-or">or email</p>
            <form className="sp-form" onSubmit={onEmail}>
              {mode === "up" ? (
                <label className="sp-field">
                  Name
                  <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
                </label>
              ) : null}
              <label className="sp-field">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="sp-field">
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                />
              </label>
              {error ? <p className="sp-form-error">{error}</p> : null}
              <button className="sp-button sp-button-solid" type="submit" disabled={pending}>
                {pending ? "Working…" : mode === "up" ? "Create operator account" : "Sign in"}
              </button>
            </form>
            <button
              type="button"
              className="sp-text-button"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError("");
              }}
            >
              {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
          </>
        ) : (
          <p className="sp-note">Sign-in is disabled.</p>
        )}
      </div>
    </SiteShell>
  );
}
