"use client";

import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { homeRouteFor } from "@/lib/rbac";
import { LanguageSwitcher } from "@/components/layouts/language-switcher";
import { ThemeToggle } from "@/components/layouts/theme-toggle";
import { Button } from "@/components/ui/button";
import { PublicNavBoundary } from "./public-nav";

/**
 * The public header.
 *
 * It is a client component so it can read the session: a signed-in visitor sees
 * a link to their own dashboard instead of the sign-in button. The language
 * and theme controls live here too, so the public screens have the same
 * preferences as the signed-in ones.
 */
export function PublicHeader() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 px-4 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HeartPulse className="size-4" />
          </span>
          <span className="text-sm font-semibold">{t("common.appName")}</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-4 text-sm md:flex">
          <PublicNavBoundary />
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <LanguageSwitcher />
          <ThemeToggle />

          {user ? (
            <Button size="sm" asChild>
              <Link href={homeRouteFor(user.role)}>{t("nav.dashboard")}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link href="/login">{t("auth.signIn")}</Link>
            </Button>
          )}
        </div>
      </div>

      {/* The directory links wrap onto their own row on small screens. */}
      <nav className="flex items-center gap-4 overflow-x-auto border-t px-1 py-2 text-sm md:hidden">
        <PublicNavBoundary />
      </nav>
    </header>
  );
}
