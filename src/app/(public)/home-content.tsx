"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  HeartPulse,
  MapPin,
  Stethoscope,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { homeRouteFor } from "@/lib/rbac";
import { useCenters } from "@/features/diagnostics/hooks/use-diagnostics";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { useHospitals } from "@/features/hospitals/hooks/use-hospitals";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * The public landing page.
 *
 * It shows the size of the demo directory so a visitor can see the platform
 * before signing in. Signed-in users are sent to their own dashboard instead.
 */
export function HomeContent() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useSession((state) => state.user);

  const hospitals = useHospitals();
  const doctors = useDoctors();
  const centers = useCenters();

  React.useEffect(() => {
    if (user) {
      router.replace(homeRouteFor(user.role));
    }
  }, [user, router]);

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const hospitalCount = hospitals.data?.length ?? 0;
  const doctorCount = doctors.data?.length ?? 0;
  const centerCount = centers.data?.length ?? 0;

  const directories = [
    {
      href: "/hospitals",
      label: t("publicPortal.browseHospitals"),
      description: t("hospitals.subtitle"),
      icon: Building2,
      count: hospitalCount,
      countLabel: t("hospitals.hospitalCount", { count: hospitalCount }),
    },
    {
      href: "/doctors",
      label: t("publicPortal.browseDoctors"),
      description: t("doctors.subtitle"),
      icon: Stethoscope,
      count: doctorCount,
      countLabel: t("doctors.doctorCount", { count: doctorCount }),
    },
    {
      href: "/diagnostic-centers",
      label: t("publicPortal.browseCenters"),
      description: t("diagnostics.subtitle"),
      icon: HeartPulse,
      count: centerCount,
      countLabel: t("diagnostics.centerCount", { count: centerCount }),
    },
  ];

  return (
    <div className="space-y-12 py-6">
      <section className="space-y-6 text-center">
        <Badge variant="outline" className="mx-auto">
          <CalendarCheck className="size-3" />
          {t("common.demo")}
        </Badge>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("common.appName")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("common.tagline")}
          </p>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            {t("publicPortal.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/login">
              {t("auth.signIn")}
              <ArrowRight />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/register">{t("auth.register")}</Link>
          </Button>
        </div>

        <p className="mx-auto max-w-xl text-xs text-muted-foreground">
          {t("common.demoDataNotice")}
        </p>
      </section>

      {/* The three public directories. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {directories.map((directory) => {
          const Icon = directory.icon;

          return (
            <Card
              key={directory.href}
              className="transition-colors hover:border-primary/50"
            >
              <CardContent className="space-y-3 p-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {directory.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {directory.description}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">
                    {directory.countLabel}
                  </span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={directory.href}>
                      {t("common.viewDetails")}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* The location screen. */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t("publicPortal.browseMaps")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("maps.subtitle")}</p>
            <Button variant="outline" size="sm" className="w-fit" asChild>
              <Link href="/maps">{t("maps.title")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarCheck className="size-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t("publicPortal.signedOutNoticeTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("publicPortal.signedOutNotice")}
            </p>
            <Button variant="outline" size="sm" className="w-fit" asChild>
              <Link href="/login">{t("auth.signIn")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <div className="flex justify-center">
        <DemoBadge />
      </div>
    </div>
  );
}
