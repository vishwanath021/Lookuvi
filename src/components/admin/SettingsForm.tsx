"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { ImportCustomers } from "@/components/admin/ImportCustomers";
import { WeekHoursEditor } from "@/components/admin/WeekHoursEditor";
import type { ToolId } from "@/lib/tools";

export function SettingsForm({
  initial,
  canRemoveBranding,
  enabledTools = ["hairstyle", "colour", "brows", "nails", "beard"],
  members,
  selfId,
  showTryOn = true,
  showDomain = false,
  showGst = false,
  teamLogins = false,
}: {
  initial: {
    name: string;
    primaryColor: string;
    accentColor: string;
    whatsapp: string;
    address: string;
    mapsUrl: string;
    city: string;
    gstin: string;
    removeBranding: boolean;
    toolColour: boolean;
    toolStyle: boolean;
    toolBrows: boolean;
    toolBeard: boolean;
    toolNails: boolean;
    hairPickerOn: boolean;
    hairSuggestOn: boolean;
    hairSuggestUsesCredits: boolean;
    anonDailyCap: number;
    memberDailyCap: number;
    monthlyTryAllowance: number;
    requireLoginToBook: boolean;
    productBridal: boolean;
    productGroom: boolean;
    productMakeupStudio?: boolean;
    visitTryLimit: number;
    tryOnsAtSalon?: boolean;
    whatsappAlmostOn?: boolean;
    whatsappWalkInJoined?: boolean;
    logoUrl: string | null;
    openTime?: string;
    closeTime?: string;
    weeklyHours?: string;
    loyaltyOn?: boolean;
    loyaltyPointsPerVisit?: number;
    rewards?: { name: string; cost: number }[];
  };
  canRemoveBranding: boolean;
  enabledTools?: ToolId[];
  members: { userId: string; name: string; email: string; role: string }[];
  selfId: string;
  showTryOn?: boolean;
  showDomain?: boolean;
  showGst?: boolean;
  teamLogins?: boolean;
}) {
  const [form, setForm] = useState({
    ...initial,
    productMakeupStudio: initial.productMakeupStudio ?? false,
    tryOnsAtSalon: initial.tryOnsAtSalon ?? true,
    whatsappAlmostOn: initial.whatsappAlmostOn ?? false,
    whatsappWalkInJoined: initial.whatsappWalkInJoined ?? false,
    openTime: initial.openTime ?? "",
    closeTime: initial.closeTime ?? "",
    weeklyHours: initial.weeklyHours ?? "",
    loyaltyOn: initial.loyaltyOn ?? true,
    loyaltyPointsPerVisit: initial.loyaltyPointsPerVisit ?? 1,
    rewards: initial.rewards ?? [],
  });
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState("");
  const [host, setHost] = useState("");
  const [domainNote, setDomainNote] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [team, setTeam] = useState(members);
  const [section, setSection] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const openDetails = () => {
      if (media.matches) setSection((current) => current ?? "details");
    };
    openDetails();
    media.addEventListener("change", openDetails);
    return () => media.removeEventListener("change", openDetails);
  }, []);
  const ownerCount = team.filter((member) => member.role === "OWNER").length;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 128 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const url = canvas.toDataURL("image/jpeg", 0.8);
      if (url.length > 180_000) {
        setMessageTone("error");
        setMessage("Logo is too large. Use a smaller image.");
        return;
      }
      set("logoUrl", url);
      setMessage("");
    } catch {
      setMessageTone("error");
      setMessage("That logo could not be read. Use a PNG or JPEG.");
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const sectionName = section || "details";
    setSaving(sectionName);
    setMessage("");
    if (!Number.isInteger(form.loyaltyPointsPerVisit) || form.loyaltyPointsPerVisit < 0 || form.loyaltyPointsPerVisit > 50) {
      setMessageTone("error");
      setMessage("Points per visit must be a whole number from 0 to 50.");
      setSaving("");
      return;
    }
    const { anonDailyCap, memberDailyCap, monthlyTryAllowance, visitTryLimit, productBridal, productGroom, productMakeupStudio, ...rest } = form;
    void anonDailyCap;
    void memberDailyCap;
    void monthlyTryAllowance;
    void visitTryLimit;
    void productBridal;
    void productGroom;
    void productMakeupStudio;
    const res = await fetch("/api/v1/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...rest,
        rewards: form.rewards
          .filter((reward) => reward.name.trim())
          .map((reward) => ({ name: reward.name.trim(), cost: Math.min(9999, Math.max(1, Math.round(Number(reward.cost)) || 1)) })),
      }),
    });
    const data = await res.json();
    setMessageTone(res.ok ? "success" : "error");
    setMessage(res.ok ? "Saved" : data.message || "Could not save");
    setSaving("");
  }

  async function addDomain(verify: boolean) {
    const res = await fetch("/api/v1/admin/domain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host, verify }),
    });
    const data = await res.json();
    setDomainNote(data.hint || data.message || (data.verified ? "Verified" : "Saved"));
  }

  async function addStaff(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/v1/admin/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: staffEmail, name: staffName, password: staffPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setMessageTone(res.ok ? "success" : "error");
    setMessage(res.ok ? "Saved" : data.message || "Could not add staff");
    if (res.ok && data.userId) {
      setTeam((current) => current.some((member) => member.userId === data.userId)
        ? current
        : [...current, { userId: data.userId, name: staffName, email: staffEmail, role: "STAFF" }]);
    }
  }

  async function removeMember(userId: string) {
    const res = await fetch("/api/v1/admin/team", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessageTone("error");
      setMessage(data.message || "Could not remove that person");
      return;
    }
    setTeam((current) => current.filter((member) => member.userId !== userId));
    setMessageTone("success");
    setMessage("Saved");
  }

  const sections = [
    { id: "details", label: "Salon details" },
    { id: "hours", label: "Opening hours" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "loyalty", label: "Loyalty" },
    { id: "look", label: "Look of your salon" },
    { id: "import", label: "Import customers" },
    ...(teamLogins ? [{ id: "team", label: "Team" }] : []),
  ];

  function Switch({ label, hint, checked, disabled = false, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {hint ? <p className="text-xs text-muted">{hint}</p> : null}
        </div>
        <button
          className={`relative h-11 w-16 shrink-0 rounded-full border border-line ${checked ? "bg-[var(--brand)]" : "bg-sand"} disabled:opacity-50`}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!checked)}
        >
          <span className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow ${checked ? "left-6" : "left-1"}`} />
        </button>
      </div>
    );
  }

  const active = section ?? "details";

  return (
    <div className="settings-menu grid items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)]" data-settings-menu="yes" data-open={section ?? ""}>
      <nav className="flex w-full flex-col gap-2 self-start" aria-label="Settings sections">
        {sections.map((item) => {
          const on = section === item.id;
          return (
            <button key={item.id} className={`btn settings-nav-btn h-11 w-full shrink-0 justify-start ${on ? "is-on" : "secondary"}`} data-default={item.id === "details" ? "yes" : undefined} type="button" aria-current={on ? "page" : undefined} onClick={() => setSection(item.id)}>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className={`${section ? "grid" : "hidden md:grid"} min-w-0 gap-3`}>
        {section ? <button className="btn ghost w-fit md:hidden" type="button" onClick={() => setSection(null)}>Back</button> : null}
        {active === "details" ? (
      <form className="card grid gap-3 p-4" onSubmit={save}>
        <h2 className="font-serif text-2xl">Salon details</h2>
        <Switch label="Try-ons only at the salon" hint="Free try-ons start when the customer is at the salon. Staff can add more at the queue." checked={form.tryOnsAtSalon} onChange={(next) => set("tryOnsAtSalon", next)} />
        <label className="text-sm">Salon name<input className="field mt-1" aria-label="Salon name" value={form.name} onChange={(event) => set("name", event.target.value)} /></label>
        <div className="text-sm">
          <span className="block">Salon logo</span>
          <input ref={logoRef} className="sr-only" type="file" accept="image/*" aria-label="Salon logo" onChange={(event) => void onLogo(event.target.files?.[0])} />
          <button className="btn secondary mt-1" type="button" onClick={() => logoRef.current?.click()}>Choose logo</button>
          <p className="mt-1 text-xs text-muted">Shown beside the salon name. Leave it empty to use the Lookuvi mark.</p>
          {form.logoUrl && (
            <div className="mt-2 flex items-center gap-3">
              <img src={form.logoUrl} alt="" className="h-14 w-14 object-contain" />
              <button className="btn secondary" type="button" onClick={() => set("logoUrl", null)}>Use Lookuvi mark</button>
            </div>
          )}
        </div>
        <label className="text-sm">Address<input className="field mt-1" value={form.address} onChange={(event) => set("address", event.target.value)} /></label>
        <label className="text-sm">Maps link<input className="field mt-1" value={form.mapsUrl} onChange={(event) => set("mapsUrl", event.target.value)} /></label>
        <label className="text-sm">City<input className="field mt-1" value={form.city} onChange={(event) => set("city", event.target.value)} /></label>
        {showGst ? <label className="text-sm">GSTIN<input className="field mt-1" value={form.gstin} onChange={(event) => set("gstin", event.target.value)} /></label> : null}
        {showTryOn ? (
        <Switch label="Phone login before a booking request" hint="When this is off, Book opens WhatsApp." checked={form.requireLoginToBook} onChange={(next) => set("requireLoginToBook", next)} />
        ) : null}
        <Switch label="Remove Powered by Lookuvi" hint={canRemoveBranding ? "" : "Pro or Chain"} checked={form.removeBranding} disabled={!canRemoveBranding} onChange={(next) => set("removeBranding", next)} />
        {showDomain ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Salon web address</h3>
            <input className="field" placeholder="try.yoursalon.in" value={host} onChange={(event) => setHost(event.target.value)} aria-label="Custom domain" />
            <div className="flex gap-2">
              <button className="btn secondary" type="button" onClick={() => void addDomain(false)}>Save host</button>
              <button className="btn secondary" type="button" onClick={() => void addDomain(true)}>Check DNS</button>
            </div>
            {domainNote && <Notice tone={/not |could not|fail/i.test(domainNote) ? "error" : "info"}>{domainNote}</Notice>}
          </div>
        ) : null}
        <button className="btn" type="submit" disabled={saving === section}>{saving === section ? "Saving…" : "Save"}</button>
        {message && section ? <Notice tone={messageTone}>{message}</Notice> : null}
      </form>
        ) : null}
        {section === "hours" ? (
      <form className="card grid gap-3 p-4" onSubmit={save}>
        <h2 className="font-serif text-2xl">Opening hours</h2>
        <WeekHoursEditor
          openTime={form.openTime}
          closeTime={form.closeTime}
          weeklyHours={form.weeklyHours}
          onChange={(next) => setForm((current) => ({ ...current, ...next }))}
        />
        <button className="btn" type="submit" disabled={saving === section}>{saving === section ? "Saving…" : "Save"}</button>
        {message && section ? <Notice tone={messageTone}>{message}</Notice> : null}
      </form>
        ) : null}
        {section === "whatsapp" ? (
      <form className="card grid gap-3 p-4" onSubmit={save}>
        <h2 className="font-serif text-2xl">WhatsApp</h2>
        <label className="text-sm">WhatsApp number<input className="field mt-1" aria-label="WhatsApp" value={form.whatsapp} onChange={(event) => set("whatsapp", event.target.value)} /></label>
        <Switch label="Almost your turn message" checked={form.whatsappAlmostOn} onChange={(next) => set("whatsappAlmostOn", next)} />
        <Switch label="Joined message for walk-ins" hint="Walk-ins added by staff. Guests who join from home still get the joined message. Booking confirmed stays on." checked={form.whatsappWalkInJoined} onChange={(next) => set("whatsappWalkInJoined", next)} />
        <button className="btn" type="submit" disabled={saving === section}>{saving === section ? "Saving…" : "Save"}</button>
        {message && section ? <Notice tone={messageTone}>{message}</Notice> : null}
      </form>
        ) : null}
        {section === "loyalty" ? (
      <form className="card grid gap-3 p-4" data-loyalty="yes" onSubmit={save}>
        <h2 className="font-serif text-2xl">Loyalty</h2>
        <Switch label="Loyalty" checked={form.loyaltyOn} onChange={(next) => set("loyaltyOn", next)} />
        <fieldset className="grid gap-2 text-sm">
          <label>Points per visit
            <input className="field narrow mt-1" inputMode="numeric" aria-invalid={form.loyaltyPointsPerVisit < 0 || form.loyaltyPointsPerVisit > 50} aria-label="Points per visit" value={String(form.loyaltyPointsPerVisit)} onChange={(event) => set("loyaltyPointsPerVisit", Number(event.target.value.replace(/\D/g, "") || "0"))} />
          </label>
          <p className="text-xs text-muted">Staff tap Finish and the guest earns this many points. There is no bill amount yet.</p>
          {form.rewards.map((reward, index) => (
            <div key={index} className="grid grid-cols-2 gap-2">
              <label>Reward
                <input className="field mt-1" aria-label={`Reward ${index + 1} name`} value={reward.name} maxLength={60} onChange={(event) => {
                  const rewards = form.rewards.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item);
                  set("rewards", rewards);
                }} />
              </label>
              <label>Points
                <input className="field mt-1" inputMode="numeric" aria-invalid={reward.cost < 1 || reward.cost > 9999} aria-label={`Reward ${index + 1} points`} value={String(reward.cost)} onChange={(event) => {
                  const rewards = form.rewards.map((item, itemIndex) => itemIndex === index ? { ...item, cost: Number(event.target.value) } : item);
                  set("rewards", rewards);
                }} />
              </label>
            </div>
          ))}
          {form.rewards.length < 5 ? (
            <button className="btn secondary w-fit" type="button" onClick={() => set("rewards", [...form.rewards, { name: "", cost: 10 }])}>Add reward</button>
          ) : null}
        </fieldset>
        <button className="btn" type="submit" disabled={saving === section}>{saving === section ? "Saving…" : "Save"}</button>
        {message && section ? <Notice tone={messageTone}>{message}</Notice> : null}
      </form>
        ) : null}
        {section === "look" ? (
      <form className="card grid gap-3 p-4" onSubmit={save}>
        <h2 className="font-serif text-2xl">Look of your salon</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Brand colour
            <input className="mt-1 h-10 w-full" type="color" aria-label="Primary" value={form.primaryColor} onChange={(event) => set("primaryColor", event.target.value)} />
          </label>
          <label className="text-sm">Accent
            <input className="mt-1 h-10 w-full" type="color" aria-label="Accent" value={form.accentColor} onChange={(event) => set("accentColor", event.target.value)} />
          </label>
        </div>
        {showTryOn ? (
          <>
            <h3 className="text-sm font-semibold">Try-on tools</h3>
            {enabledTools.includes("colour") ? <Switch label="Live colour" checked={form.toolColour} onChange={(next) => set("toolColour", next)} /> : null}
            {enabledTools.includes("hairstyle") ? <Switch label="Hairstyle preview" checked={form.toolStyle} onChange={(next) => set("toolStyle", next)} /> : null}
            {enabledTools.includes("brows") ? <Switch label="Eyebrow mapping" checked={form.toolBrows} onChange={(next) => set("toolBrows", next)} /> : null}
            {enabledTools.includes("beard") ? <Switch label="Beard try-on" checked={form.toolBeard} onChange={(next) => set("toolBeard", next)} /> : null}
            {enabledTools.includes("nails") ? <Switch label="Nail try-on" checked={form.toolNails} onChange={(next) => set("toolNails", next)} /> : null}
            <h3 className="text-sm font-semibold">Hair suggestions</h3>
            <Switch label="Hair-type picker" hint="Free. Density and texture filter the style photos." checked={form.hairPickerOn} onChange={(next) => set("hairPickerOn", next)} />
            <Switch label="Get AI suggestions" hint="Off by default. One reading of the photo, then style photos from this menu." checked={form.hairSuggestOn} onChange={(next) => set("hairSuggestOn", next)} />
            <Switch label="Use 1 try-on for a new suggestion" hint="Repeat clicks on the same photo stay free." checked={form.hairSuggestUsesCredits} onChange={(next) => set("hairSuggestUsesCredits", next)} />
          </>
        ) : null}
        <button className="btn" type="submit" disabled={saving === section}>{saving === section ? "Saving…" : "Save"}</button>
        {message && section ? <Notice tone={messageTone}>{message}</Notice> : null}
      </form>
        ) : null}
        {section === "import" ? <ImportCustomers /> : null}
        {section === "team" && teamLogins ? (
      <section id="team" className="card grid gap-3 p-4">
        <h2 className="font-serif text-2xl">Team</h2>
        <ol className="grid gap-1 text-sm">
          <li>1. Add their email, name, and a password of at least 12 characters.</li>
          <li>2. They sign in on the salon login page with that email and password.</li>
          <li>3. Staff see the queue and customers. Settings and prices stay with you.</li>
          <li>4. More than one shop? Each shop is its own salon, with its own team.</li>
        </ol>
        <ul className="space-y-2">
          {team.map((member) => {
            const canRemove = member.userId !== selfId && !(member.role === "OWNER" && ownerCount <= 1);
            return (
              <li key={member.userId} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {member.name}
                  <span className="block text-xs text-muted">{member.email} · {member.role === "OWNER" ? "Owner" : "Staff"}</span>
                </span>
                {canRemove ? <button className="btn secondary" type="button" onClick={() => void removeMember(member.userId)}>Remove</button> : null}
              </li>
            );
          })}
        </ul>
      <form className="grid gap-2" onSubmit={addStaff}>
        <h3 className="font-medium">Add staff</h3>
        <input className="field" type="email" placeholder="Email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} required aria-label="Staff email" />
        <input className="field" placeholder="Name" value={staffName} onChange={(event) => setStaffName(event.target.value)} required aria-label="Staff name" />
        <input className="field" type="password" placeholder="Password, at least 12 characters" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} required minLength={12} aria-label="Staff password" />
        <button className="btn" type="submit">Create staff login</button>
        {message ? <Notice tone={messageTone}>{message}</Notice> : null}
      </form>
      </section>
        ) : null}
      </div>
    </div>
  );
}
