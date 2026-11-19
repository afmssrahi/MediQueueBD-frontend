"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useLogin } from "@/features/authentication/hooks/use-auth";
import { homeRouteFor } from "@/lib/rbac";
import { DEMO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthShell } from "../auth-shell";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useLogin();
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = (values: LoginValues) => {
    login.mutate(
      {
        email: values.email,
        password: values.password,
        remember: values.remember,
      },
      {
        onSuccess: (user) => {
          router.push(homeRouteFor(user.role));
        },
      },
    );
  };

  const fillDemoAccount = (email: string) => {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", DEMO.PASSWORD, { shouldValidate: true });
  };

  return (
    <AuthShell
      title={t("auth.signInTitle")}
      subtitle={t("auth.signInSubtitle")}
      footer={
        <>
          <span>{t("auth.noAccountYet")}</span>{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("auth.register")}
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {login.error && (
            <Alert variant="destructive">
              <AlertDescription>{login.error.message}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.email")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="patient@mediqueue.bd"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="remember"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">
                  {t("auth.rememberMe")}
                </FormLabel>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={login.isPending}
          >
            <LogIn />
            {login.isPending ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </form>
      </Form>

      <DemoAccountPicker onSelect={fillDemoAccount} />
    </AuthShell>
  );
}

/**
 * The demo account picker.
 *
 * One pre-filled account per role, so the six dashboards can be reviewed
 * without hunting for credentials.
 */
function DemoAccountPicker({
  onSelect,
}: {
  onSelect: (email: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const accounts = [
    { role: "PATIENT", email: "patient@mediqueue.bd", label: "Patient", labelBn: "রোগী" },
    { role: "DOCTOR", email: "doctor@mediqueue.bd", label: "Doctor", labelBn: "ডাক্তার" },
    { role: "HOSPITAL_STAFF", email: "staff@mediqueue.bd", label: "Hospital staff", labelBn: "হাসপাতাল স্টাফ" },
    { role: "HOSPITAL_ADMIN", email: "hospitaladmin@mediqueue.bd", label: "Hospital admin", labelBn: "হাসপাতাল প্রশাসক" },
    { role: "DIAGNOSTIC_STAFF", email: "diagnostic@mediqueue.bd", label: "Diagnostic staff", labelBn: "ডায়াগনস্টিক স্টাফ" },
    { role: "SYSTEM_ADMIN", email: "admin@mediqueue.bd", label: "System admin", labelBn: "সিস্টেম প্রশাসক" },
  ];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-lg border border-dashed p-3 text-left transition-colors hover:bg-accent/40"
      >
        <span>
          <span className="block text-sm font-medium">{t("auth.demoAccounts")}</span>
          <span className="block text-xs text-muted-foreground">
            {t("auth.demoAccountsHint")}
          </span>
        </span>
        <DemoBadge label={t("auth.demoOnly")} />
      </button>

      {open && (
        <div className="grid gap-2 sm:grid-cols-2">
          {accounts.map((account) => (
            <button
              key={account.role}
              type="button"
              onClick={() => {
                onSelect(account.email);
                setOpen(false);
              }}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-accent/40",
              )}
            >
              <span className="block text-sm font-medium">{account.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {account.email}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
