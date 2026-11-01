"use client";

import { LookuviLockup } from "@/components/brand/LookuviMark";
import { MAGIC_LINK_REJECTED, homeForUser, interpretMagicResult, type MagicSignInResult } from "@/lib/auth/magic-destination";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

/** One in-flight automatic redeem per token, so a strict-mode remount does not burn the link twice. */
const automaticAttempts = new Map<string, Promise<MagicSignInResult | undefined>>();

async function signInWithMagic(token: string, totp: string) {
  try {
    const result = await signIn("magic", { token, totp, redirect: false });
    return (result ?? undefined) as MagicSignInResult | undefined;
  } catch {
    return { error: "CredentialsSignin", ok: false } satisfies MagicSignInResult;
  }
}

function automaticMagic(token: string) {
  let pending = automaticAttempts.get(token);
  if (!pending) {
    pending = signInWithMagic(token, "");
    automaticAttempts.set(token, pending);
  }
  return pending;
}

export function LoginForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [magicToken, setMagicToken] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);

  const finishMagic = useCallback(async (result: MagicSignInResult | undefined) => {
    const outcome = interpretMagicResult(result);
    if (outcome.kind === "totp") {
      setNeedTotp(true);
      setMagicBusy(false);
      setMessage(outcome.invalid ? "That authenticator code was not accepted." : "Enter the 6-digit code from your authenticator, or a recovery code.");
      return;
    }
    if (outcome.kind === "rejected") {
      setMagicToken("");
      setNeedTotp(false);
      setMagicBusy(false);
      setMessage(MAGIC_LINK_REJECTED);
      return;
    }
    const session = await fetch("/api/auth/session").then((res) => res.json()).catch(() => null);
    const user = session && typeof session === "object" && "user" in session ? (session as { user?: { isSuperAdmin?: boolean } }).user : undefined;
    window.location.assign(homeForUser(user));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    setReady(true);
    if (!token) return;
    setMagicToken(token);
    setMagicBusy(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    const next = `${url.pathname}${url.search}${url.hash}` || "/login";
    window.history.replaceState({}, "", next);
    let cancelled = false;
    void automaticMagic(token).then((result) => {
      if (!cancelled) void finishMagic(result);
    });
    return () => {
      cancelled = true;
    };
  }, [finishMagic]);

  async function onPassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const result = await signIn("credentials", { email, password, totp, redirect: false });
    if (result?.code === "rate_limit") setMessage("Too many sign-in attempts. Wait a few minutes and try again.");
    else if (result?.code === "totp_required" || result?.code === "totp_invalid") {
      setNeedTotp(true);
      setMessage(result.code === "totp_invalid" ? "That authenticator code was not accepted." : "Enter the 6-digit code from your authenticator, or a recovery code.");
    } else if (result?.error) setMessage("Those details did not match.");
    else window.location.href = "/admin";
  }

  async function onMagicTotp(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setMagicBusy(true);
    await finishMagic(await signInWithMagic(magicToken, totp));
  }

  const completingMagic = Boolean(magicToken) && needTotp;

  return (
    <div className="card mx-auto max-w-md p-6">
      <LookuviLockup />
      <h1 className="page-title mt-6">Salon login</h1>
      <p className="mt-2 text-sm text-muted">Owners and staff sign in with email and password.</p>
      {completingMagic ? (
        <form className="mt-4 space-y-3" onSubmit={onMagicTotp}>
          <label className="block text-sm">Authenticator or recovery code
            <input className="field mt-1" inputMode="text" autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value)} required />
          </label>
          <button className="btn w-full" type="submit" disabled={magicBusy}>{magicBusy ? "Signing in…" : "Confirm code"}</button>
        </form>
      ) : (
        <form className="mt-4 space-y-3" method="post" action="/login" data-ready={ready ? "yes" : "no"} onSubmit={onPassword}>
          <label className="block text-sm">Email
            <input className="field mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block text-sm">Password
            <input className="field mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>
          {needTotp && (
            <label className="block text-sm">Authenticator or recovery code
              <input className="field mt-1" inputMode="text" autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value)} required />
            </label>
          )}
          <button className="btn w-full" type="submit" disabled={!ready || magicBusy}>{ready ? "Sign in" : "Loading…"}</button>
        </form>
      )}
      <p className="mt-3 text-sm"><a href="/login/reset">Forgot password</a></p>
      {magicBusy && <p className="mt-3 text-sm" role="status">Signing you in…</p>}
      {message && <p className="mt-3 text-sm" role={message === MAGIC_LINK_REJECTED ? "alert" : "status"}>{message}</p>}
    </div>
  );
}
