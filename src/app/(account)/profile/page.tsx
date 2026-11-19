"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import {
  useChangePassword,
  useUpdateProfile,
} from "@/features/authentication/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLOOD_GROUPS, GENDERS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const profileSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  phone: z.string().min(6, "Enter a valid phone number"),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContact: z.string().optional(),
  nid: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(6, "Use at least six characters"),
    confirmPassword: z.string().min(1, "Repeat the new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

/**
 * The profile screen.
 *
 * One screen for every role: the personal details, the account type and the
 * password. The details are saved to the demo database through the same
 * service the real API will use.
 */
export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      address: user?.address ?? "",
      dateOfBirth: user?.dateOfBirth ?? "",
      gender: user?.gender ?? "",
      bloodGroup: user?.bloodGroup ?? "",
      emergencyContact: user?.emergencyContact ?? "",
      nid: user?.nid ?? "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // `useWatch` subscribes to the fields the selects render, so the React
  // Compiler can memoise this component safely.
  const [gender, bloodGroup] = useWatch({
    control: profileForm.control,
    name: ["gender", "bloodGroup"],
  });

  const onSaveProfile = (values: ProfileValues) => {
    updateProfile.mutate(
      {
        ...values,
        address: values.address || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender || undefined,
        bloodGroup: values.bloodGroup || undefined,
        emergencyContact: values.emergencyContact || undefined,
        nid: values.nid || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("profile.profileUpdated"));
        },
      },
    );
  };

  const onChangePassword = (values: PasswordValues) => {
    changePassword.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          passwordForm.reset();
          toast.success(t("profile.passwordChanged"));
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("profile.title")}
        description={t("profile.subtitle")}
        actions={<DemoBadge />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4" />
                {t("profile.personalDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={profileForm.handleSubmit(onSaveProfile)}
                className="grid gap-4 md:grid-cols-2"
              >
                <Field
                  label={t("auth.fullName")}
                  error={profileForm.formState.errors.name?.message}
                >
                  <Input
                    {...profileForm.register("name")}
                    aria-label={t("auth.fullName")}
                  />
                </Field>

                <Field
                  label={t("auth.email")}
                  hint={t("common.notAvailable")}
                >
                  <Input value={user?.email ?? ""} disabled readOnly />
                </Field>

                <Field
                  label={t("auth.phone")}
                  error={profileForm.formState.errors.phone?.message}
                >
                  <Input
                    {...profileForm.register("phone")}
                    aria-label={t("auth.phone")}
                  />
                </Field>

                <Field
                  label={t("auth.dateOfBirth")}
                  error={profileForm.formState.errors.dateOfBirth?.message}
                >
                  <Input
                    type="date"
                    {...profileForm.register("dateOfBirth")}
                    aria-label={t("auth.dateOfBirth")}
                  />
                </Field>

                <Field label={t("auth.gender")}>
                  <Select
                    value={gender ?? ""}
                    onValueChange={(value) =>
                      profileForm.setValue("gender", value)
                    }
                  >
                    <SelectTrigger aria-label={t("auth.gender")}>
                      <SelectValue placeholder={t("form.selectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={t("auth.bloodGroup")}>
                  <Select
                    value={bloodGroup ?? ""}
                    onValueChange={(value) =>
                      profileForm.setValue("bloodGroup", value)
                    }
                  >
                    <SelectTrigger aria-label={t("auth.bloodGroup")}>
                      <SelectValue placeholder={t("form.selectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label={t("auth.emergencyContact")}
                  error={profileForm.formState.errors.emergencyContact?.message}
                >
                  <Input
                    {...profileForm.register("emergencyContact")}
                    aria-label={t("auth.emergencyContact")}
                  />
                </Field>

                <Field
                  label={t("auth.nid")}
                  error={profileForm.formState.errors.nid?.message}
                >
                  <Input
                    {...profileForm.register("nid")}
                    aria-label={t("auth.nid")}
                  />
                </Field>

                <Field
                  label={t("common.address")}
                  className="md:col-span-2"
                  error={profileForm.formState.errors.address?.message}
                >
                  <Textarea
                    {...profileForm.register("address")}
                    aria-label={t("common.address")}
                  />
                </Field>

                <div className="flex justify-end md:col-span-2">
                  <Button type="submit" disabled={updateProfile.isPending}>
                    <Save />
                    {updateProfile.isPending
                      ? t("common.saving")
                      : t("common.save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-4" />
                {t("profile.changePassword")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={passwordForm.handleSubmit(onChangePassword)}
                className="grid gap-4 md:grid-cols-2"
              >
                <Field
                  label={t("profile.currentPassword")}
                  className="md:col-span-2"
                  error={
                    passwordForm.formState.errors.currentPassword?.message
                  }
                >
                  <PasswordInput
                    autoComplete="current-password"
                    revealLabel={t("common.showPassword")}
                    concealLabel={t("common.hidePassword")}
                    {...passwordForm.register("currentPassword")}
                    aria-label={t("profile.currentPassword")}
                  />
                </Field>

                <Field
                  label={t("profile.newPassword")}
                  hint={t("profile.passwordHint")}
                  error={passwordForm.formState.errors.newPassword?.message}
                >
                  <PasswordInput
                    autoComplete="new-password"
                    revealLabel={t("common.showPassword")}
                    concealLabel={t("common.hidePassword")}
                    {...passwordForm.register("newPassword")}
                    aria-label={t("profile.newPassword")}
                  />
                </Field>

                <Field
                  label={t("profile.confirmPassword")}
                  error={
                    passwordForm.formState.errors.confirmPassword?.message
                  }
                >
                  <PasswordInput
                    autoComplete="new-password"
                    revealLabel={t("common.showPassword")}
                    concealLabel={t("common.hidePassword")}
                    {...passwordForm.register("confirmPassword")}
                    aria-label={t("profile.confirmPassword")}
                  />
                </Field>

                <div className="flex justify-end md:col-span-2">
                  <Button type="submit" disabled={changePassword.isPending}>
                    <Save />
                    {changePassword.isPending
                      ? t("common.saving")
                      : t("common.save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("profile.role")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Badge variant="secondary">
                {user ? t(`roles.${user.role}`) : "—"}
              </Badge>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("profile.memberSince")}
                </p>
                <p className="mt-1 font-medium">
                  {user ? formatDate(user.createdAt) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("auth.email")}
                </p>
                <p className="mt-1 font-medium">{user?.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("auth.phone")}
                </p>
                <p className="mt-1 font-medium">{user?.phone ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * A password field with a show/hide toggle.
 *
 * The visibility state lives inside the field so each password input controls
 * its own eye button.
 */
function PasswordInput({
  revealLabel,
  concealLabel,
  ...props
}: React.ComponentProps<"input"> & {
  revealLabel: string;
  concealLabel: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className="pr-10"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? concealLabel : revealLabel}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** One labelled form field. */
function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
