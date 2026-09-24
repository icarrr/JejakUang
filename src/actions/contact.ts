"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { contactSchema } from "@/lib/validation";

export type ActionState = { error?: string };

export async function createContactAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUser();
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  await db.insert(contacts).values({
    userId,
    name: parsed.data.name.trim(),
    phone: parsed.data.phone || null,
    notes: parsed.data.notes || null,
  });
  revalidatePath("/loans");
  revalidatePath("/transactions/new");
  return {};
}