import { RouteGuard } from "@/components/layouts/route-guard";
import { AppShell } from "@/components/layouts/app-shell";

/** The diagnostic centre shell. */
export default function DiagnosticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allow={["DIAGNOSTIC_STAFF"]}>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
