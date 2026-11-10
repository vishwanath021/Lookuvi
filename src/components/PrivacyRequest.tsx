"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { demoSlug } from "@/lib/demo-slug";

function salonKey(value: string) {
  const trimmed = value.trim();
  const fromPath = trimmed.match(/\/s\/([a-z0-9-]+)/i);
  if (fromPath) return fromPath[1];
  return trimmed.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/\.lookuvi\..*$/i, "");
}

export function PrivacyRequest() {
  const [slug, setSlug] = useState(() => demoSlug());
  const [contact, setContact] = useState("");
  const [kind, setKind] = useState("delete");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"error" | "warning" | "info" | "success">("info");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (kind === "delete" && !window.confirm("Delete your booking request for this salon? Only a request from this browser, or from your signed-in phone, is removed.")) return;
    const sessionId = sessionStorage.getItem("helix_session");
    const res = await fetch("/api/v1/data-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: salonKey(slug), kind, contact, sessionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      setTone("warning");
      setMessage(data.message || "Too many privacy requests from this connection. Please wait up to an hour and try again.");
      return;
    }
    if (!res.ok) {
      setTone("error");
      setMessage(data.message || "That request could not be sent. Check the salon name and try again.");
      return;
    }
    setTone(data.deleted > 0 ? "success" : kind === "delete" ? "warning" : "info");
    setMessage(data.message || "Request recorded.");
  }

  return (
    <form className="card space-y-3 p-4" onSubmit={submit}>
      <h2 className="font-serif text-2xl">Request access, correction, deletion, or withdrawal</h2>
      <label className="block text-sm">Which salon?
        <input className="field mt-1" aria-label="Which salon?" value={slug} onChange={(event) => setSlug(event.target.value)} required />
      </label>
      <p className="text-xs text-muted">Use the name from your Lookuvi link, for example demo.</p>
      <label className="block text-sm">Email or phone
        <input className="field mt-1" value={contact} onChange={(event) => setContact(event.target.value)} required />
      </label>
      <label className="block text-sm">Request
        <select className="field mt-1" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="withdraw">Withdraw consent</option>
          <option value="delete">Delete my lead</option>
          <option value="access">Access what you store</option>
          <option value="correct">Correct my details</option>
          <option value="grievance">Grievance / complaint</option>
        </select>
      </label>
      <button className="btn" type="submit">Send</button>
      {message ? <Notice tone={tone}>{message}</Notice> : null}
    </form>
  );
}
