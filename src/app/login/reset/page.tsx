"use client";

import { useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const token = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "";

  async function requestLink(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/v1/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setIsError(!res.ok);
    if (!res.ok) {
      setMessage(res.status === 429 ? "Too many attempts. Please wait a few minutes and try again." : data.message || "Password reset is temporarily unavailable. Please contact support.");
      return;
    }
    setMessage(data.message || "If that account exists, we sent a reset link.");
    if (data.devUrl) setMessage(`${data.message} Dev link: ${data.devUrl}`);
  }

  async function choosePassword(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/v1/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setIsError(!res.ok);
    setMessage(data.message || (res.ok ? "Password updated. You can sign in now." : "This reset link is invalid or has expired. Request a new one."));
  }

  return (
    <main className="px-4 py-16">
      <div className="card mx-auto max-w-md p-6">
        <h1 className="page-title">Reset password</h1>
        {token ? (
          <form className="mt-4 space-y-3" onSubmit={choosePassword}>
            <label className="block text-sm">New password
              <input className="field mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} />
            </label>
            <button className="btn w-full" type="submit">Update password</button>
          </form>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={requestLink}>
            <label className="block text-sm">Email
              <input className="field mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <button className="btn w-full" type="submit">Email a reset link</button>
          </form>
        )}
        {message && (
          <p
            className={isError ? "mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" : "mt-3 text-sm"}
            role={isError ? "alert" : "status"}
          >
            {message}
          </p>
        )}
        <a className="btn secondary mt-4 w-full text-center" href="/login" data-testid="back-to-sign-in">Back to sign in</a>
      </div>
    </main>
  );
}
