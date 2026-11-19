"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * The public directory links.
 *
 * The links are dictionary-driven so they follow the language switch, and the
 * active one is highlighted the same way the signed-in sidebar does it.
 *
 * `usePathname` is only available at runtime, so the component reads it
 * inside a Suspense boundary — otherwise Next.js cannot prerender the route.
 */
export function PublicNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const items = [
    { href: "/hospitals", labelKey: "nav.hospitals" },
    { href: "/doctors", labelKey: "nav.doctors" },
    { href: "/diagnostic-centers", labelKey: "nav.diagnosticCenters" },
    { href: "/maps", labelKey: "nav.maps" },
  ];

  return (
    <>
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "transition-colors hover:text-foreground",
              active
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </>
  );
}

/**
 * The navigation, wrapped so the runtime pathname can stream in.
 *
 * The links render immediately because the list is static — only the active
 * highlight waits for the pathname.
 */
export function PublicNavBoundary() {
  return (
    <React.Suspense fallback={<PublicNavFallback />}>
      <PublicNav />
    </React.Suspense>
  );
}

/** The static links, rendered before the pathname is known. */
function PublicNavFallback() {
  const { t } = useTranslation();

  const items = [
    { href: "/hospitals", labelKey: "nav.hospitals" },
    { href: "/doctors", labelKey: "nav.doctors" },
    { href: "/diagnostic-centers", labelKey: "nav.diagnosticCenters" },
    { href: "/maps", labelKey: "nav.maps" },
  ];

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </>
  );
}
