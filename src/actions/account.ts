"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { moneyAccounts } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { accountSchema } from "@/lib/validation";

export type ActionState = { error?: string };

export async function createAccountAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUser();
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    initialBalance: Number(formData.get("initialBalance") ?? 0),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  await db.insert(moneyAccounts).values({
    userId,
    name: parsed.data.name.trim(),
    type: parsed.data.type,
    initialBalance: parsed.data.initialBalance,
  });
  revalidatePath("/");
  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function updateAccountAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUser();
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    initialBalance: Number(formData.get("initialBalance") ?? 0),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const existing = await db.query.moneyAccounts.findFirst({
    where: and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, userId)),
  });
  if (!existing) return { error: "Akun tidak ditemukan" };

  await db
    .update(moneyAccounts)
    .set({
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      initialBalance: parsed.data.initialBalance,
    })
    .where(and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, userId)));
  revalidatePath("/");
  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function deactivateAccountAction(id: string): Promise<ActionState> {
  const userId = await requireUser();
  const existing = await db.query.moneyAccounts.findFirst({
    where: and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, userId)),
  });
  if (!existing) return { error: "Akun tidak ditemukan" };

  await db
    .update(moneyAccounts)
    .set({ isActive: false })
    .where(and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, userId)));
  revalidatePath("/");
  revalidatePath("/accounts");
  return {};
}