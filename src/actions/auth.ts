"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, users } from "@/db/schema";
import { DEFAULT_CATEGORIES } from "@/db/seed-categories";
import { signIn, signOut } from "@/auth";
import { signupSchema } from "@/lib/validation";

export type ActionState = { error?: string };

export async function registerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });
  if (existing) return { error: "Email sudah terdaftar" };

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ name, email: normalizedEmail, passwordHash })
    .returning();

  await db.insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((c) => ({
        userId: user.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        isDefault: true,
      }))
    )
    .onConflictDoNothing();

  redirect("/login?registered=1");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      redirect("/");
    }
    return { error: "Email atau password salah" };
  }
  redirect("/");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}