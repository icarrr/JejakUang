"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { categorySchema } from "@/lib/validation";

export type ActionState = { error?: string };

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUser();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    icon: formData.get("icon") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  await db.insert(categories).values({
    userId,
    name: parsed.data.name.trim(),
    type: parsed.data.type,
    icon: parsed.data.icon,
    isDefault: false,
  });
  revalidatePath("/settings");
  redirect("/settings");
}

export async function updateCategoryAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUser();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    icon: formData.get("icon") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.id, id), eq(categories.userId, userId)),
  });
  if (!existing) return { error: "Kategori tidak ditemukan" };

  await db
    .update(categories)
    .set({ name: parsed.data.name.trim(), icon: parsed.data.icon })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  revalidatePath("/settings");
  redirect("/settings");
}

export async function deactivateCategoryAction(id: string): Promise<ActionState> {
  const userId = await requireUser();
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.id, id), eq(categories.userId, userId)),
  });
  if (!existing) return { error: "Kategori tidak ditemukan" };

  await db
    .update(categories)
    .set({ isActive: false })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  revalidatePath("/settings");
  return {};
}