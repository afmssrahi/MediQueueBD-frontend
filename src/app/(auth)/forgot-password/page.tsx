"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MailWarning } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useForgotPassword } from "@/features/authentication/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthShell } from "../auth-shell";

const forgotSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const forgot = useForgotPassword();

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: ForgotValues) => {
    forgot.mutate(values, {
      onSuccess: (result) => {
        router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
        void result;
      },
    });
  };

  return (
    <AuthShell
      title={t("auth.forgotTitle")}
      subtitle={t("auth.forgotSubtitle")}
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← {t("auth.signIn")}
        </Link>
      }
    >
      <Alert variant="warning">
        <MailWarning className="size-4" />
        <AlertDescription>{t("auth.noEmailSent")}</AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {forgot.error && (
            <Alert variant="destructive">
              <AlertDescription>{forgot.error.message}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.email")}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={forgot.isPending}>
            {forgot.isPending ? t("common.loading") : t("auth.forgotPassword")}
          </Button>
        </form>
      </Form>

      <Button
        variant="ghost"
        className="w-full"
        onClick={() => router.push("/login")}
      >
        <ArrowLeft />
        {t("common.back")}
      </Button>
    </AuthShell>
  );
}
