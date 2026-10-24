import { appBaseUrl } from "@/lib/env";
import type { NotifyMessage } from "@/lib/notify";

export function statusPath(slug: string, ref: string) {
  return `/s/${slug}/q/${ref}`;
}

export function statusUrl(slug: string, ref: string) {
  return `${appBaseUrl()}${statusPath(slug, ref)}`;
}

export function queueHomePath(slug: string) {
  return `/s/${slug}/queue`;
}

export function queueHomeUrl(slug: string) {
  return `${appBaseUrl()}${queueHomePath(slug)}`;
}

export function tryOnUrl(slug: string) {
  return `${appBaseUrl()}/s/${slug}`;
}

function withLinks(base: string, home: string, tryOn: string) {
  return `${base} Join from home: ${home} Try a look: ${tryOn}`;
}

export function joinedMessage(input: { salon: string; token: number; waitMin: number; link: string; home: string; tryOn: string }): NotifyMessage {
  return {
    to: "",
    kind: "joined",
    body: withLinks(`${input.salon}: you have joined, token ${input.token}, about ${input.waitMin} min. ${input.link}`, input.home, input.tryOn),
    parameters: [input.salon, String(input.token), String(input.waitMin), input.link, input.home, input.tryOn],
  };
}

export function almostMessage(input: { salon: string; token: number; waitMin: number; link: string; home: string; tryOn: string }): NotifyMessage {
  const core = input.waitMin <= 0
    ? `${input.salon}: token ${input.token}, please come in now. ${input.link}`
    : `${input.salon}: token ${input.token}, about ${input.waitMin} min left. ${input.link}`;
  return {
    to: "",
    kind: "almost",
    body: withLinks(core, input.home, input.tryOn),
    parameters: [input.salon, String(input.token), String(input.waitMin), input.link, input.home, input.tryOn],
  };
}

export function confirmedMessage(input: { salon: string; date: string; slot: string; link: string; home: string; tryOn: string }): NotifyMessage {
  return {
    to: "",
    kind: "confirmed",
    body: withLinks(`${input.salon}: your visit is confirmed for ${input.date} at ${input.slot}. ${input.link}`, input.home, input.tryOn),
    parameters: [input.salon, input.date, input.slot, input.link, input.home, input.tryOn],
  };
}

export function reminderMessage(input: { salon: string; join: string; tryOn: string }): NotifyMessage {
  return {
    to: "",
    kind: "reminder",
    body: `Time for your next visit at ${input.salon}? Join the queue from home: ${input.join} Try a look: ${input.tryOn} Reply STOP to opt out.`,
    parameters: [input.salon, input.join, input.tryOn],
  };
}

export function offerMessage(input: { salon: string; offer: string; join: string; tryOn: string }): NotifyMessage {
  return {
    to: "",
    kind: "offer",
    body: `${input.salon}: ${input.offer} Join the queue from home: ${input.join} Try a look: ${input.tryOn} Reply STOP to opt out.`,
    parameters: [input.salon, input.offer, input.join, input.tryOn],
  };
}

export function deskWhatsAppText(salon: string, token: number, name: string, links?: { home: string; tryOn: string }) {
  const who = name.trim() || "there";
  const extra = links ? ` Join from home next time: ${links.home} Try a look: ${links.tryOn}` : "";
  return `Hi ${who}, this is ${salon}. Your token is ${token}.${extra}`;
}
