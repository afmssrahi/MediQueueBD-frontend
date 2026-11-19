import { RouteGuard } from "@/components/layouts/route-guard";
import { AppShell } from "@/components/layouts/app-shell";
import { ROLES } from "@/types";

/**
 * The profile shell.
 *
 * Every role has a profile, so the guard allows all six. The page itself is
 * the only screen outside the per-role route groups.
 */
export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allow={[...ROLES]}>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
