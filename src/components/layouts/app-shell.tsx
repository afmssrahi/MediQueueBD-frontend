"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { useTranslation } from "@/i18n/provider";
import { can } from "@/lib/rbac";
import { ROLE_NAV, type NavItem } from "./role-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { RoleSwitcher } from "./role-switcher";

/**
 * The application shell.
 *
 * The sidebar is role-aware: the items come from `ROLE_NAV` and are filtered
 * by the RBAC permission map, so a role never sees a link it cannot open.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const role = useSession((state) => state.user?.role ?? null);
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const collapsed = useUi((state) => state.sidebarCollapsed);
  const toggleSidebar = useUi((state) => state.toggleSidebar);
  // The drawer records the route it was opened on, so a navigation closes it
  // without a setState inside an effect.
  const [drawerRoute, setDrawerRoute] = React.useState<string | null>(null);
  const mobileOpen = drawerRoute === pathname;
  const setMobileOpen = (open: boolean) =>
    setDrawerRoute(open ? pathname : null);

  const sections = role ? ROLE_NAV[role] : [];

  const isActive = (item: NavItem) => {
    if (item.matchPrefix === false) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.permission ? can(role, item.permission as never) : true,
      ),
    }))
    .filter((section) => section.items.length > 0);

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <HeartPulseIcon />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold">{t("common.appName")}</span>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.titleKey} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(section.titleKey)}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn("w-full justify-start gap-3", collapsed && "justify-center px-0")}
        >
          <ChevronDown className="size-4 rotate-90" />
          {!collapsed && <span className="text-xs">Collapse</span>}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X /> : <Menu />}
        </Button>

        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HeartPulseIcon />
          </div>
          <span className="text-sm font-semibold">{t("common.appName")}</span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <RoleSwitcher />
          <LanguageSwitcher />
          <ThemeToggle />
          <NotificationBell />

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent">
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                  <Badge variant="secondary" className="mt-1.5">
                    {t(`roles.${user.role}`)}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">{t("common.profile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    signOut();
                    router.replace("/login");
                  }}
                >
                  <LogOut />
                  {t("common.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-sidebar lg:block">
          <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col">
            {sidebarContent}
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            />
            <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r bg-sidebar">
              <div className="flex h-14 items-center justify-between border-b px-4">
                <span className="text-sm font-semibold">{t("common.appName")}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X />
                </Button>
              </div>
              <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
                {visibleSections.map((section) => (
                  <div key={section.titleKey} className="space-y-1">
                    <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t(section.titleKey)}
                    </p>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            isActive(item)
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{t(item.labelKey)}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function HeartPulseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 13H9.5l.5-1 1 4 1.5-6 1.5 3h5.27" />
    </svg>
  );
}
