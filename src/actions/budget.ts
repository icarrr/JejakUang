"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { budgets, categories } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { budgetSchema } from "@/lib/validation";

export type ActionState = { error?: string };

async function assertOwnsCategory(userId: string, id: string): Promise<boolean> {
  const row = await db.query.categories.findFirst({
    where: and(eq(categories.userId, userId), eq(categories.id, id)),
    columns: { id: true },
  });
  return !!row;
}

function parseAmount(value: FormDataEntryValue | null): number | undefined {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : undefined;
}

export async function upsertBudgetAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUser();
  const parsed = budgetSchema.safeParse({
    categoryId: formData.get("categoryId"),
    amount: parseAmount(formData.get("amount")),
    month: formData.get("month"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  if (!(await assertOwnsCategory(userId, parsed.data.categoryId))) {
    return { error: "Kategori tidak ditemukan" };
  }

  await db
    .insert(budgets)
    .values({
      userId,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
      month: parsed.data.month,
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.month],
      set: { amount: parsed.data.amount },
    });
  revalidatePath("/reports");
  return {};
}

export async function deleteBudgetAction(id: string): Promise<ActionState> {
  const userId = await requireUser();
  await db
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  revalidatePath("/reports");
  return {};
}