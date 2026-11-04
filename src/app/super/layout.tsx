import { SuperNav } from "@/components/admin/SuperShell";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip-provider";

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="md:grid md:min-h-screen md:grid-cols-[15rem_minmax(0,1fr)]">
        <SuperNav />
        <TooltipProvider>
          <div className="min-w-0">{children}</div>
        </TooltipProvider>
      </div>
      <Toaster />
    </>
  );
}
