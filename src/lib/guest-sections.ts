export type GuestSection = "everyday" | "bridal" | "groom" | "makeup";

/** Tabs the customer can see. A hidden product is left out. */
export function guestSections(args: { everyday: boolean; bridal: boolean; groom: boolean; makeup?: boolean }): GuestSection[] {
  const sections: GuestSection[] = [];
  if (args.everyday) sections.push("everyday");
  if (args.bridal) sections.push("bridal");
  if (args.groom) sections.push("groom");
  if (args.makeup) sections.push("makeup");
  return sections;
}

const SECTION_COPY: Record<GuestSection, { label: string; hint: string }> = {
  everyday: { label: "Everyday", hint: "Hair, colour, brows" },
  bridal: { label: "Bridal", hint: "Hair, makeup, jewellery" },
  groom: { label: "Groom", hint: "Hair, beard, grooming" },
  makeup: { label: "Makeup", hint: "Photo makeup" },
};

export function guestSectionCopy(section: GuestSection) {
  return SECTION_COPY[section];
}
