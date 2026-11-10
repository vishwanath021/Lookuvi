"use client";

import { useRef, useState } from "react";
import { Notice, RequiredMark } from "@/components/ui/Notice";
import { classifyImportFile, decodeImportText, parseCustomerImport } from "@/lib/customers/parse";

export function ImportCustomers() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [tone, setTone] = useState<"error" | "warning" | "info" | "success">("info");
  const [busy, setBusy] = useState("");
  const [exists, setExists] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState("");
  const [fileText, setFileText] = useState("");

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setNotice("");
    const res = await fetch("/api/v1/admin/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const text = data.message || (res.ok ? "Saved." : "That did not work.");
    setExists(Boolean(data.exists));
    setTone(!res.ok ? (data.exists ? "warning" : "error") : "success");
    setNotice(text);
    setBusy("");
    return res.ok;
  }

  async function chooseFile(file: File | undefined) {
    setFileName("");
    setPreview("");
    setFileText("");
    setNotice("");
    if (!file) return;
    setFileName(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = classifyImportFile(bytes);
    if (kind !== "text") {
      setTone("warning");
      setNotice("This file is a spreadsheet, not a CSV. In Google Sheets use Share, then Download, then Comma-separated values (.csv).");
      return;
    }
    const text = decodeImportText(bytes);
    const parsed = parseCustomerImport(text);
    if (parsed.tooLong) {
      setTone("error");
      setNotice("That file has more than 500 rows. Split it and import again.");
      return;
    }
    setFileText(text);
    const sample = parsed.skipped.slice(0, 3).map((skip) => `Line ${skip.line}: ${skip.reason}`).join(" ");
    setPreview(`${parsed.rows.length} ready to add. ${parsed.invalid} will be skipped.${sample ? ` ${sample}` : ""}`);
  }

  return (
    <section className="card grid gap-3 p-4" data-import-customers="yes">
      <h2 className="font-serif text-2xl">Import customers</h2>
      <p className="text-sm text-muted">Add a number, or bring in a phone book as CSV, so come-back reminders can reach people who have never used the queue.</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send({ action: "add", phone, name, updateName: exists }, exists ? "rename" : "add").then((ok) => {
            if (ok) {
              setPhone("");
              setName("");
              setExists(false);
            }
          });
        }}
      >
        <label className="min-w-0 flex-1 text-sm">Phone<RequiredMark />
          <input className="field mt-1" inputMode="tel" aria-label="Phone" placeholder="Phone" value={phone} onChange={(event) => { setPhone(event.target.value); setExists(false); }} required />
        </label>
        <label className="min-w-0 flex-1 text-sm">Name
          <input className="field mt-1" aria-label="Name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        </label>
        <button className="btn self-end" type="submit" disabled={busy !== ""}>
          {busy === "add" || busy === "rename" ? "Saving…" : exists ? "Update name" : "Add"}
        </button>
      </form>
      <div className="grid gap-2">
        <input
          ref={fileRef}
          className="hidden"
          type="file"
          accept=".csv,text/csv,application/vnd.ms-excel,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="CSV upload"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void chooseFile(file);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn secondary" type="button" disabled={busy !== ""} onClick={() => fileRef.current?.click()}>Choose CSV</button>
          {fileName ? <span className="text-sm" data-import-file={fileName}>{fileName}</span> : null}
        </div>
        {preview ? <p className="text-sm text-muted" data-import-preview="yes">{preview}</p> : null}
        {fileText ? (
          <button className="btn w-fit" type="button" disabled={busy !== ""} onClick={() => void send({ action: "import", text: fileText }, "import").then((ok) => { if (ok) { setFileText(""); setPreview(""); } })}>
            {busy === "import" ? "Importing…" : "Import"}
          </button>
        ) : null}
      </div>
      {notice ? <Notice tone={tone}>{notice}</Notice> : null}
    </section>
  );
}
