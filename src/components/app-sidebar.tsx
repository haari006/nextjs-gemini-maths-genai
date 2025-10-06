"use client";

import { GraduationCap, History, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const routes = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: GraduationCap,
  },
  {
    href: "/questions",
    label: "Question Lab",
    icon: ListChecks,
  },
  {
    href: "/past-questions",
    label: "Past questions",
    icon: History,
  },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="bg-sidebar">
        <SidebarHeader className="px-3 py-4">
          <div className="flex items-center gap-3 rounded-2xl bg-primary/10 px-3 py-2">
            <span className="text-2xl font-headline text-primary">
              Math Buddy
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-[0.7rem] uppercase tracking-[0.4em] text-sidebar-foreground/70">
              Navigate
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {routes.map((route) => {
                  const isActive = pathname?.startsWith(route.href);
                  return (
                    <SidebarMenuItem key={route.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          href={route.href}
                          className="flex items-center gap-3"
                        >
                          <route.icon className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {route.label}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="px-3 pb-4">
          <p className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/80">
            Crafted for curious minds. Switch between your overview and
            challenge lab anytime.
          </p>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {children}
    </SidebarProvider>
  );
}

export function AppSidebarTrigger() {
  return <SidebarTrigger className="text-primary" />;
}
