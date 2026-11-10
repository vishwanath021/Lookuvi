export type GuestNavId = "try" | "services" | "join" | "saved";

export function guestJoinHref(args: { slug: string; showQueue: boolean; bookHref?: string }) {
  if (args.showQueue) return `/s/${args.slug}/queue`;
  if (args.bookHref) return args.bookHref;
  return `/s/${args.slug}/queue`;
}

export function guestNavCurrent(path: string, slug: string): GuestNavId {
  const base = `/s/${slug}`;
  if (path === `${base}/services` || path.startsWith(`${base}/services/`)) return "services";
  if (path === `${base}/saved` || path.startsWith(`${base}/saved/`)) return "saved";
  if (path === `${base}/queue` || path.startsWith(`${base}/queue/`) || path.startsWith(`${base}/q/`)) return "join";
  return "try";
}
