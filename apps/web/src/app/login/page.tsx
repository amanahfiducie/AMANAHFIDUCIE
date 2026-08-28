"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError } from "@/lib/api";
import { resolveHomePath } from "@/lib/auth-routing";
import type { LoginChallengeInfo } from "@/providers/auth-provider";
import { useAuth } from "@/providers/auth-provider";

type LoginStep = "credentials" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { startLogin, completeLogin, user, loading } = useAuth();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || undefined;

  const [step, setStep] = useState<LoginStep>("credentials");
  const [displayStep, setDisplayStep] = useState<LoginStep>("credentials");
  const [stepDirection, setStepDirection] = useState<"forward" | "back">("forward");
  const [stepLeaving, setStepLeaving] = useState(false);
  const [stepEntering, setStepEntering] = useState(false);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStepSettled = useRef<(() => void) | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<LoginChallengeInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath || resolveHomePath(user));
    }
  }, [loading, user, router, nextPath]);

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearTimeout(stepTimer.current);
    };
  }, []);

  function settleStep(next: LoginStep) {
    setDisplayStep(next);
    setStepLeaving(false);
    setStepEntering(true);
    onStepSettled.current?.();
    onStepSettled.current = null;
    if (stepTimer.current) clearTimeout(stepTimer.current);
    stepTimer.current = setTimeout(() => setStepEntering(false), 500);
  }

  function goToStep(next: LoginStep, afterSettle?: () => void) {
    if (next === step || stepLeaving) return;
    const prefersReduced =
      typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const direction = next === "otp" ? "forward" : "back";
    setStepDirection(direction);
    setStep(next);
    onStepSettled.current = afterSettle ?? null;

    if (prefersReduced) {
      settleStep(next);
      setStepEntering(false);
      return;
    }

    setStepLeaving(true);
    setStepEntering(false);
    if (stepTimer.current) clearTimeout(stepTimer.current);
    stepTimer.current = setTimeout(() => settleStep(next), 280);
  }

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const info = await startLogin(identifier.trim(), password);
      setChallenge(info);
      setOtp("");
      goToStep("otp");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Identifiants incorrects ou serveur indisponible.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtp(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setError("Saisissez les 6 chiffres du code reçu par e-mail.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completeLogin(challenge.challengeToken, code, nextPath);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Code invalide ou expiré. Recommencez la connexion si besoin.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function backToCredentials() {
    setOtp("");
    setError(null);
    goToStep("credentials", () => setChallenge(null));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--sf-cream)]">
        <div className="flex flex-col items-center gap-3 text-[var(--sf-green)]">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--sf-gold)]/30 border-t-[var(--sf-gold)]" />
          <p className="text-sm text-[var(--sf-green)]/70">Vérification de session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="login-pattern relative hidden w-[46%] flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:w-[52%] xl:p-14">
        <div className="login-hero-media" aria-hidden>
          <Image
            src="/brand/login-hero-family.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 0px"
          />
        </div>
        <div className="login-hero-overlay" aria-hidden />

        <div className="login-animate-in relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full shadow-[0_8px_24px_rgb(0_0_0/0.25)] ring-2 ring-[var(--sf-gold)]/55">
              <Image
                src="/brand/logo-icon.png"
                alt="AMANAH FIDUCIE"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-[0.22em] text-[var(--sf-gold-soft)] uppercase">
                AMANAH FIDUCIE
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white drop-shadow-sm">
                SOFIGEPAM Connect
              </p>
            </div>
          </div>
        </div>

        <div className="login-animate-in-delay relative z-10 max-w-lg">
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-[1.12] font-semibold tracking-tight text-white drop-shadow-md xl:text-[2.75rem]">
            Ce qui nous est confié, nous&nbsp;le protégeons avec&nbsp;honneur
          </h1>
          <div className="login-gold-line my-7 w-28" aria-hidden />
          <blockquote className="max-w-md border-l-2 border-[var(--sf-gold)]/70 pl-5">
            <p className="font-[family-name:var(--font-display)] text-lg leading-snug text-white/95 italic drop-shadow-sm xl:text-xl">
              «&nbsp;Allah vous ordonne de rendre les dépôts à&nbsp;leurs ayants
              droit.&nbsp;»
            </p>
            <footer className="mt-3 text-xs font-medium tracking-[0.14em] text-[var(--sf-gold-soft)] uppercase">
              Coran — An-Nisāʾ, 4&nbsp;:&nbsp;58
            </footer>
          </blockquote>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/75 drop-shadow-sm">
            Derrière chaque dossier, une famille. Derrière chaque décision, une
            amanah.
          </p>
        </div>

        <div className="login-animate-in-delay relative z-10 flex items-end justify-between gap-6 border-t border-white/15 pt-8">
          <p className="text-xs leading-relaxed text-white/55">
            © {new Date().getFullYear()} AMANAH FIDUCIE — SOFIGEPAM.
            <br />
            Accès réservé aux utilisateurs autorisés.
          </p>
          <Image
            src="/brand/logo-seal.png"
            alt=""
            width={64}
            height={64}
            className="opacity-40 mix-blend-screen drop-shadow-md"
          />
        </div>
      </aside>

      <main className="login-panel flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-24">
        <div className="login-animate-in mx-auto w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="relative h-11 w-11 overflow-hidden rounded-full ring-2 ring-[var(--sf-gold)]/50">
              <Image
                src="/brand/logo-icon.png"
                alt="AMANAH FIDUCIE"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-[0.2em] text-[var(--sf-green)]/60 uppercase">
                AMANAH FIDUCIE
              </p>
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--sf-green-deep)]">
                SOFIGEPAM Connect
              </p>
            </div>
          </div>

          <div className="login-card rounded-2xl p-8 sm:p-10">
            <div className="login-step mb-6">
              <span className="login-step-dots" aria-hidden>
                <span
                  className="login-step-dot"
                  data-active={step === "credentials" || step === "otp" ? "true" : "false"}
                />
                <span
                  className="login-step-dot"
                  data-active={step === "otp" ? "true" : "false"}
                />
              </span>
              Étape {step === "credentials" ? "1" : "2"} sur 2
            </div>

            {error ? (
              <div className="mb-6">
                <ErrorAlert message={error} />
              </div>
            ) : null}

            <div
              key={displayStep}
              className={[
                "login-step-panel",
                stepLeaving ? "is-leaving" : "",
                stepEntering ? "is-entering" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-direction={stepDirection}
            >
              <div className="mb-8">
                <h2 className="font-[family-name:var(--font-display)] text-[2rem] leading-tight font-semibold tracking-tight text-[var(--sf-green-deep)] sm:text-[2.15rem]">
                  {displayStep === "credentials"
                    ? "Bienvenue"
                    : "Vérifiez votre identité"}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--sf-green)]/65">
                  {displayStep === "credentials"
                    ? "Entrez vos identifiants pour accéder à votre espace sécurisé."
                    : challenge
                      ? challenge.deliveryNotice ??
                        `Un code a été envoyé à ${challenge.maskedEmail}. Valable 10 minutes.`
                      : null}
                </p>
              </div>

              {displayStep === "otp" && challenge?.devCode ? (
                <div
                  className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
                  role="status"
                >
                  <p className="font-medium">Mode développement</p>
                  <p className="mt-1 text-xs text-amber-900/80">
                    {challenge.devNotice ??
                      "Code affiché ici car l'e-mail n'est pas configuré en local."}
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold tracking-[0.35em]">
                    {challenge.devCode}
                  </p>
                </div>
              ) : null}

              {displayStep === "credentials" ? (
                <form onSubmit={handleCredentials} className="space-y-5">
                  <div>
                    <label
                      htmlFor="identifier"
                      className="block text-[13px] font-medium text-[var(--sf-green-deep)]"
                    >
                      Identifiant, e-mail ou téléphone
                    </label>
                    <input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="H000042, e-mail ou +221 77…"
                      className="login-input mt-2 w-full rounded-xl border border-[var(--sf-cream-dark)] px-4 py-3.5 text-[var(--sf-green-deep)] placeholder:text-[var(--sf-green)]/35 outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-[13px] font-medium text-[var(--sf-green-deep)]"
                    >
                      Mot de passe
                    </label>
                    <div className="relative mt-2">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Votre mot de passe"
                        className="login-input w-full rounded-xl border border-[var(--sf-cream-dark)] py-3.5 pr-24 pl-4 text-[var(--sf-green-deep)] placeholder:text-[var(--sf-green)]/35 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="login-toggle absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs font-medium"
                        aria-label={
                          showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                        }
                      >
                        {showPassword ? "Masquer" : "Afficher"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || stepLeaving}
                    className="login-btn mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white"
                  >
                    {submitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Vérification…
                      </>
                    ) : (
                      "Continuer"
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleOtp} className="space-y-5">
                  <div>
                    <label
                      htmlFor="otp"
                      className="block text-[13px] font-medium text-[var(--sf-green-deep)]"
                    >
                      Code à 6 chiffres
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      className="login-input login-otp mt-2 w-full rounded-xl border border-[var(--sf-cream-dark)] px-4 py-4 text-center text-2xl font-semibold text-[var(--sf-green-deep)] outline-none"
                    />
                    <p className="mt-2.5 text-xs leading-relaxed text-[var(--sf-green)]/50">
                      Consultez votre boîte de réception — le code peut aussi se trouver
                      dans les indésirables.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || otp.length !== 6 || stepLeaving}
                    className="login-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Connexion…
                      </>
                    ) : (
                      "Valider et accéder"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={backToCredentials}
                    disabled={stepLeaving}
                    className="w-full py-1 text-center text-sm text-[var(--sf-green)]/55 transition hover:text-[var(--sf-green-deep)] disabled:opacity-50"
                  >
                    ← Modifier mes identifiants
                  </button>
                </form>
              )}
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] leading-relaxed tracking-wide text-[var(--sf-green)]/40">
            Connexion sécurisée · Code e-mail valable 10 minutes
          </p>
        </div>
      </main>
    </div>
  );
}
