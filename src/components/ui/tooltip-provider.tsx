"use client";

import * as Tooltip from "@radix-ui/react-tooltip";

/** Tooltips for the page column only. The sidebar stays outside this client boundary. */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider delayDuration={200}>{children}</Tooltip.Provider>;
}
