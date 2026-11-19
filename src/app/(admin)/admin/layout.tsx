import { RouteGuard } from "@/components/layouts/route-guard";
import { AppShell } from "@/components/layouts/app-shell";

/** The system administrator shell. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allow={["SYSTEM_ADMIN"]}>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
