import { RouteGuard } from "@/components/layouts/route-guard";
import { AppShell } from "@/components/layouts/app-shell";

/** The doctor shell — the guard and the frame every doctor page sits in. */
export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allow={["DOCTOR"]}>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
