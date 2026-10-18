export type GuestSection = "everyday" | "bridal" | "groom";

/** Tabs the customer can see. A hidden product is left out. */
export function guestSections(args: { everyday: boolean; bridal: boolean; groom: boolean }): GuestSection[] {
  const sections: GuestSection[] = [];
  if (args.everyday) sections.push("everyday");
  if (args.bridal) sections.push("bridal");
  if (args.groom) sections.push("groom");
  return sections;
}
