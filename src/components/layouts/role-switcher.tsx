"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserCog } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useSwitchRole } from "@/features/authentication/hooks/use-auth";
import { homeRouteFor } from "@/lib/rbac";
import { DEMO } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DemoBadge } from "@/components/shared/demo-badge";

/**
 * The demo role switcher.
 *
 * It exists only because this is a prototype: it signs in as another seeded
 * account so every role can be reviewed without typing credentials. It is
 * clearly labelled as a demo tool.
 */
export function RoleSwitcher() {
  const { t } = useTranslation();
  const router = useRouter();
  const currentUser = useSession((state) => state.user);
  const switchRole = useSwitchRole();

  const accounts = [
    { role: "PATIENT", email: "patient@mediqueue.bd", label: "Patient", labelBn: "রোগী" },
    { role: "DOCTOR", email: "doctor@mediqueue.bd", label: "Doctor", labelBn: "ডাক্তার" },
    { role: "HOSPITAL_STAFF", email: "staff@mediqueue.bd", label: "Hospital staff", labelBn: "হাসপাতাল স্টাফ" },
    { role: "HOSPITAL_ADMIN", email: "hospitaladmin@mediqueue.bd", label: "Hospital admin", labelBn: "হাসপাতাল প্রশাসক" },
    { role: "DIAGNOSTIC_STAFF", email: "diagnostic@mediqueue.bd", label: "Diagnostic staff", labelBn: "ডায়াগনস্টিক স্টাফ" },
    { role: "SYSTEM_ADMIN", email: "admin@mediqueue.bd", label: "System admin", labelBn: "সিস্টেম প্রশাসক" },
  ];

  const onSwitch = (email: string) => {
    switchRole.mutate(email, {
      onSuccess: (user) => {
        router.push(homeRouteFor(user.role));
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={switchRole.isPending}
          aria-label={t("common.switchRole")}
        >
          <UserCog className="size-4" />
          <span className="hidden sm:inline">{t("common.switchRole")}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          {t("auth.chooseAnotherRole")}
          <DemoBadge label={t("common.demo")} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((account) => (
          <DropdownMenuItem
            key={account.role}
            onClick={() => onSwitch(account.email)}
            className={
              currentUser?.role === account.role ? "bg-accent" : undefined
            }
          >
            <span className="flex flex-col">
              <span className="text-sm font-medium">{account.label}</span>
              <span className="text-xs text-muted-foreground">
                {account.email}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {t("auth.demoAccountsHint")} · {DEMO.PASSWORD}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
