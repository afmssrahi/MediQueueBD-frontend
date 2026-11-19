import { RouteGuard } from "@/components/layouts/route-guard";
import { AppShell } from "@/components/layouts/app-shell";

/** The hospital staff shell. */
export default function HospitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allow={["HOSPITAL_STAFF", "HOSPITAL_ADMIN"]}>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
