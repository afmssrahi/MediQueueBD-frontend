import { RouteGuard } from "@/components/layouts/route-guard";
import { AppShell } from "@/components/layouts/app-shell";

/** The patient shell — the guard and the frame every patient page sits in. */
export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allow={["PATIENT"]}>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
