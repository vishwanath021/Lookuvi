/** Shared 22px contact marks. The green glyph is the WhatsApp brand colour. */
export function WhatsAppIcon({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" className={className}>
      <path fill="#25D366" d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10 10 0 0 0 4.65 1.18h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2zm5.76 13.89c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.41-.14-.94-.31-1.62-.6-2.85-1.23-4.7-4.1-4.84-4.29-.14-.19-1.16-1.54-1.16-2.94s.73-2.08 1-2.37c.24-.27.64-.39.85-.39h.61c.2 0 .46-.04.72.55.27.64.92 2.2.1 2.3.1.16.05.3-.04.46l-.28.4c-.1.12-.2.25-.09.48.14.27.63 1.04 1.36 1.68.93.83 1.72 1.09 1.98 1.21.24.12.38.1.52-.06l.4-.47c.14-.16.3-.13.5-.08.21.06 1.32.62 1.55.73.23.12.38.17.44.27.05.1.05.58-.19 1.26z" />
    </svg>
  );
}

export function PhoneIcon({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" className={className}>
      <path fill="currentColor" d="M6.62 10.79a15.1 15.1 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 7a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}
