"use client";

import { useState } from "react";
import { LeadStatus } from "@/components/admin/LeadStatus";
import { Notice } from "@/components/ui/Notice";
import { indianMobile } from "@/lib/queue/phone";

export type LeadItem = {
  id: string;
  when: string;
  look: string;
  shade: string;
  type: string;
  eventName: string;
  eventDate: string;
  name: string;
  phone: string;
  status: string;
};

function phoneLinks(phone: string) {
  const mobile = indianMobile(phone);
  if (!mobile) return null;
  return { callUrl: `tel:+${mobile}`, whatsappUrl: `https://wa.me/${mobile}` };
}

export function LeadList({ leads }: { leads: LeadItem[] }) {
  const [rows, setRows] = useState(leads);
  const [notice, setNotice] = useState("");

  async function remove(lead: LeadItem) {
    const who = lead.name || "this guest";
    if (!window.confirm(`Delete the lead for ${who}? This only removes it from your salon.`)) return;
    const res = await fetch(`/api/v1/admin/leads/${lead.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.message || "That lead could not be deleted.");
      return;
    }
    setRows((current) => current.filter((row) => row.id !== lead.id));
    setNotice("Lead deleted.");
  }

  return (
    <div className="grid gap-3">
      {notice ? <Notice tone={notice === "Lead deleted." ? "success" : "error"}>{notice}</Notice> : null}
      {rows.length === 0 ? <p className="card p-4 text-sm">No booking taps yet. A lead is created when a guest taps Book this look.</p> : null}
      <div className="grid gap-3 md:hidden">
        {rows.map((lead) => <LeadCard key={lead.id} lead={lead} onDelete={() => void remove(lead)} />)}
      </div>
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="w-36 py-2">When</th>
              <th>Look</th>
              <th className="w-40">Guest</th>
              <th className="w-40">Status</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => {
              const links = phoneLinks(lead.phone);
              return (
                <tr key={lead.id} className="border-t border-line align-top">
                  <td className="py-3 pr-2 text-muted">{lead.when}</td>
                  <td className="py-3 pr-2">
                    <LookLine lead={lead} />
                  </td>
                  <td className="py-3 pr-2">
                    <p>{lead.name || "—"}</p>
                    {links ? <PhoneLinks links={links} /> : <p className="text-xs text-muted">No phone shared</p>}
                  </td>
                  <td className="py-3"><LeadStatus id={lead.id} status={lead.status} /></td>
                  <td className="py-3 text-right">
                    <button className="btn secondary min-h-11" type="button" onClick={() => void remove(lead)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LookLine({ lead }: { lead: LeadItem }) {
  const chip = lead.type === "BRIDAL" ? "Bridal" : lead.type === "GROOM" ? "Groom" : "";
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{lead.look}</span>
        {chip ? <span className="rounded-full bg-[#F3E6D8] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">{chip}</span> : null}
      </p>
      {lead.shade ? <p className="text-xs text-muted">{lead.shade}</p> : null}
      {lead.eventDate ? <p className="text-sm text-muted">{[lead.eventName, lead.eventDate].filter(Boolean).join(" · ")}</p> : null}
    </div>
  );
}

function PhoneLinks({ links }: { links: { callUrl: string; whatsappUrl: string } }) {
  return (
    <p className="mt-1 flex gap-2 text-sm">
      <a href={links.callUrl}>Call</a>
      <a href={links.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>
    </p>
  );
}

function LeadCard({ lead, onDelete }: { lead: LeadItem; onDelete: () => void }) {
  const links = phoneLinks(lead.phone);
  return (
    <article className="card grid gap-2 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <LookLine lead={lead} />
        </div>
        <LeadStatus id={lead.id} status={lead.status} />
      </div>
      <p className="text-sm">{lead.name || "No name"}{lead.eventDate ? "" : ""}</p>
      {links ? <PhoneLinks links={links} /> : <p className="text-sm text-muted">No phone shared</p>}
      <p className="text-sm text-muted">{lead.when}</p>
      <button className="btn secondary min-h-11 w-fit" type="button" onClick={onDelete}>Delete</button>
    </article>
  );
}
