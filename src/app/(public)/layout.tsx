import { PublicHeader } from "./public-header";

/**
 * The public shell.
 *
 * The directory screens are readable without an account, so this frame is
 * deliberately lighter than the signed-in `AppShell`: a header, the public
 * links and the page body.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t px-4 py-6 text-center text-xs text-muted-foreground">
        MediQueue BD — frontend prototype. Every figure on this site comes from
        demo data.
      </footer>
    </div>
  );
}
