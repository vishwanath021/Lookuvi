"use client";

import { useEffect, useState, type ReactNode } from "react";

/** "Change the message" lands on the reminder card only. The rest of Settings stays on the settings page. */
export function SettingsFocus({ reminder, rest }: { reminder: ReactNode; rest: ReactNode }) {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  if (hash === "#reminders") return <>{reminder}</>;
  return <>{rest}</>;
}
