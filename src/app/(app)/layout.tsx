import type { ReactNode } from "react";

import { AppSidebar, AppSidebarTrigger } from "@/components/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppSidebar>
      <SidebarInset className="bg-gradient-to-br from-[#eef2ff] via-white to-[#f4fbff]">
        <div className="relative flex min-h-screen flex-col">
          <div className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl sm:h-80 sm:w-80" />
          <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-accent/15 blur-3xl sm:h-96 sm:w-96" />
          <div className="pointer-events-none absolute bottom-[-6rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl sm:h-[26rem] sm:w-[26rem]" />
          <header className="relative z-10 flex items-center justify-between border-b border-border/40 bg-white/80 px-4 py-4 shadow-sm backdrop-blur lg:px-8">
            <div className="flex items-center gap-3">
              <AppSidebarTrigger />
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Gemini Math Buddy</p>
                <h1 className="font-headline text-xl text-foreground">Learning HQ</h1>
              </div>
            </div>
          </header>
          <main className="relative z-10 flex-1 px-4 py-6 sm:px-8 sm:py-8">
            {children}
          </main>
        </div>
      </SidebarInset>
    </AppSidebar>
  );
}
