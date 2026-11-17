import { isPlatformLogo, LookuviMark } from "@/components/brand/LookuviMark";

/** Shared guest header. The salon logo is the same mark on queue, ticket, services, and saved. */
export function SalonBrand({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const own = !isPlatformLogo(logoUrl);
  return (
    <header className="salon-bar header-metal mb-4 flex items-center gap-3 px-4 py-3" data-salon-brand="yes">
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
        {own ? <img src={logoUrl || ""} alt="" className="h-8 w-8 object-contain" data-salon-logo="yes" /> : <LookuviMark className="h-8 w-8" />}
      </span>
      <h1 className="min-w-0 flex-1 text-lg leading-tight">{name}</h1>
    </header>
  );
}
