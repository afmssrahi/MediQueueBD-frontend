"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useRegister } from "@/features/authentication/hooks/use-auth";
import { homeRouteFor } from "@/lib/rbac";
import { BLOOD_GROUPS, GENDERS } from "@/lib/constants";
import { ROLES, type Role } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthShell } from "../auth-shell";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    phone: z.string().min(6, "Phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    role: z.enum(ROLES),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    bloodGroup: z.string().optional(),
    address: z.string().optional(),
    emergencyContact: z.string().optional(),
    nid: z.string().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The two passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

const ROLE_LABEL_KEYS: Record<Role, string> = {
  PATIENT: "auth.rolePatient",
  DOCTOR: "auth.roleDoctor",
  HOSPITAL_STAFF: "auth.roleStaff",
  HOSPITAL_ADMIN: "auth.roleHospitalAdmin",
  DIAGNOSTIC_STAFF: "auth.roleDiagnostic",
  SYSTEM_ADMIN: "auth.roleSystemAdmin",
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const register = useRegister();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: "PATIENT",
      dateOfBirth: "",
      gender: "",
      bloodGroup: "",
      address: "",
      emergencyContact: "",
      nid: "",
    },
  });

  const onSubmit = (values: RegisterValues) => {
    register.mutate(
      {
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: values.role,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender || undefined,
        bloodGroup: values.bloodGroup || undefined,
        address: values.address || undefined,
        emergencyContact: values.emergencyContact || undefined,
        nid: values.nid || undefined,
      },
      {
        onSuccess: (user) => {
          router.push(homeRouteFor(user.role));
        },
      },
    );
  };

  // `useWatch` subscribes to the role so the patient-only fields appear and
  // disappear as the account type changes.
  const role = useWatch({ control: form.control, name: "role" });

  return (
    <AuthShell
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
      footer={
        <>
          <span>{t("auth.alreadyHaveAccount")}</span>{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {register.error && (
            <Alert variant="destructive">
              <AlertDescription>{register.error.message}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.fullName")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.phone")}</FormLabel>
                <FormControl>
                  <Input placeholder="+880 1712 345678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.role")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("form.selectOption")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(ROLE_LABEL_KEYS[option])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {role === "PATIENT" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.dateOfBirth")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.gender")}</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("form.selectOption")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {GENDERS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.bloodGroup")}</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("form.selectOption")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BLOOD_GROUPS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.emergencyContact")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="nid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("auth.nid")}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({t("common.optional")})
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <Button type="submit" className="w-full" disabled={register.isPending}>
            <UserPlus />
            {register.isPending ? t("common.loading") : t("auth.register")}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
