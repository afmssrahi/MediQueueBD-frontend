import * as React from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n/provider";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBadge } from "@/components/shared/demo-badge";
import { LanguageSwitcher } from "@/components/layouts/language-switcher";
import { ThemeToggle } from "@/components/layouts/theme-toggle";

/**
 * The shared frame for the authentication screens.
 *
 * The right-hand panel explains what the prototype is and what it is not, so
 * a reviewer never mistakes the demo for a working medical system.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t("common.appName")}</span>
            <DemoBadge />
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>

            <Card>
              <CardContent className="space-y-5 p-6">{children}</CardContent>
            </Card>

            {footer && (
              <p className="text-center text-sm text-muted-foreground">
                {footer}
              </p>
            )}
          </div>
        </main>
      </div>

      <aside className="hidden border-l bg-muted/40 lg:flex lg:flex-col lg:justify-center lg:p-12">
        <div className="max-w-md space-y-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              {t("common.appName")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("common.tagline")}</p>
          </div>

          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• {t("common.demoDataNotice")}</li>
            <li>• {t("common.simulatedNotice")}</li>
            <li>• {t("auth.noEmailSent")}</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
