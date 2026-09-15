import { AppShell } from "@/components/app-shell";
import { requireOwnerSession } from "@/lib/auth/web-session";

export default async function ProtectedLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireOwnerSession();
  return <AppShell>{children}</AppShell>;
}
