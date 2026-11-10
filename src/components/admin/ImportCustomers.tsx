"use client";

import { useRef, useState } from "react";

export function ImportCustomers() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/v1/admin/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setNotice(data.message || (res.ok ? "Saved." : "That did not work."));
    setBusy(false);
    return res.ok;
  }

  return (
    <section className="card grid gap-3 p-4" data-import-customers="yes">
      <h2 className="font-serif text-2xl">Import customers</h2>
      <p className="text-sm text-muted">Add a number, or bring in a phone book as CSV, so come-back reminders can reach people who have never used the queue.</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send({ action: "add", phone, name }).then((ok) => {
            if (ok) {
              setPhone("");
              setName("");
            }
          });
        }}
      >
        <input className="field min-w-0 flex-1" inputMode="tel" aria-label="Phone" placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <input className="field min-w-0 flex-1" aria-label="Name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        <button className="btn" type="submit" disabled={busy}>Add</button>
      </form>
      <div>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept=".csv,text/csv,text/plain"
          aria-label="CSV upload"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void file.text().then((text) => send({ action: "import", text }));
          }}
        />
        <button className="btn secondary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>Choose CSV</button>
      </div>
      {notice ? <p className="text-sm" role="status">{notice}</p> : null}
    </section>
  );
}
