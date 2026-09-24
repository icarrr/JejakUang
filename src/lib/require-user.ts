import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Server-side guard: returns session or redirects to /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}