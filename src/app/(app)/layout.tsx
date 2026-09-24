import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NavShell } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <NavShell userName={session.user.name ?? session.user.email ?? ""}>
      {children}
    </NavShell>
  );
}