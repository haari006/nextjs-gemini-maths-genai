import type { ReactNode } from "react";

import { AppSidebar, AppSidebarTrigger } from "@/components/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppSidebar>
      <SidebarInset className="bg-background">
        <div className="flex min-h-screen flex-col">
          <header className="flex w-full items-center gap-4 border-b border-border/50 bg-white px-4 py-4 shadow-sm lg:px-6">
            <AppSidebarTrigger />
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-2xl">
                🧮
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">Math Buddy</p>
                <h1 className="font-headline text-xl text-foreground">Learning Lab</h1>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        </div>
      </SidebarInset>
    </AppSidebar>
  );
}
