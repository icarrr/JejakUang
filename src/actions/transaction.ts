"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, contacts, moneyAccounts, receipts, transactions, transfers } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { transactionSchema } from "@/lib/validation";
import { isLoanType, ledgerRemaining, ledgerTypeOf, syncLoanLedger } from "@/lib/loans";
import { storage, validateReceiptFile } from "@/lib/storage";
import type { TxType } from "@/lib/balance";

export type ActionState = { error?: string };

function parseAmountInput(value: FormDataEntryValue | null): number | undefined {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : undefined;
}

const REVALIDATE = ["/", "/transactions", "/loans", "/reports"];

async function assertOwnsAccounts(userId: string, ids: string[]): Promise<boolean> {
  if (!ids.length) return false;
  const rows = await db
    .select({ id: moneyAccounts.id })
    .from(moneyAccounts)
    .where(and(eq(moneyAccounts.userId, userId), inArray(moneyAccounts.id, ids)));
  return rows.length === new Set(ids).size;
}

async function assertOwnsCategory(userId: string, id: string | undefined): Promise<boolean> {
  if (!id) return true;
  const row = await db.query.categories.findFirst({
    where: and(eq(categories.userId, userId), eq(categories.id, id)),
    columns: { id: true },
  });
  return !!row;
}

async function assertOwnsContact(userId: string, id: string | undefined): Promise<boolean> {
  if (!id) return true;
  const row = await db.query.contacts.findFirst({
    where: and(eq(contacts.userId, userId), eq(contacts.id, id)),
    columns: { id: true },
  });
  return !!row;
}

/** Resolve contact: existing id, or inline-created from contactName (PRD #49 flow). */
async function resolveContact(
  userId: string,
  contactId: string | undefined,
  contactName: string | undefined
): Promise<{ id: string | null; error?: string }> {
  if (contactId) {
    if (!(await assertOwnsContact(userId, contactId))) return { id: null, error: "Kontak tidak ditemukan" };
    return { id: contactId };
  }
  const name = (contactName ?? "").trim();
  if (!name) return { id: null, error: "Kontak belum dipilih" };
  const [created] = await db.insert(contacts).values({ userId, name }).returning();
  return { id: created.id };
}

/** Guard: repayment/payment cannot exceed remaining (PRD #19: Piutang → 0). */
async function assertLoanAmountValid(
  userId: string,
  type: TxType,
  contactId: string,
  amount: number
): Promise<string | null> {
  if (type === "LOAN_REPAYMENT") {
    const remaining = await ledgerRemaining(userId, contactId, "LOAN_GIVEN");
    if (amount > remaining) return "Pembayaran melebihi sisa piutang";
  }
  if (type === "DEBT_PAYMENT") {
    const remaining = await ledgerRemaining(userId, contactId, "DEBT_RECEIVED");
    if (amount > remaining) return "Pembayaran melebihi sisa hutang";
  }
  return null;
}

async function uploadReceiptIfAny(userId: string, transactionId: string, formData: FormData) {
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) return;
  const err = validateReceiptFile(file);
  if (err) throw new Error(err);
  const { url } = await storage().put(file);
  await db.insert(receipts).values({
    userId,
    transactionId,
    fileName: file.name || "struk",
    fileUrl: url,
    mimeType: file.type,
    fileSize: file.size,
  });
}

/** Remove stored files for a transaction (rows cascade on tx delete). */
async function removeReceiptFiles(userId: string, transactionId: string) {
  const rows = await db.query.receipts.findMany({
    where: and(eq(receipts.userId, userId), eq(receipts.transactionId, transactionId)),
  });
  await Promise.all(rows.map((r) => storage().remove(r.fileUrl).catch(() => {})));
}

export async function createTransactionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUser();
  const type = String(formData.get("type") ?? "") as TxType;

  const input = {
    type,
    amount: parseAmountInput(formData.get("amount")),
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
    date: formData.get("date") ?? "",
    accountId: formData.get("accountId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    sourceAccountId: formData.get("sourceAccountId") ?? "",
    destinationAccountId: formData.get("destinationAccountId") ?? "",
    contactId: formData.get("contactId") ?? "",
  };

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const data = parsed.data;
  const date = new Date(`${data.date}T12:00:00`);

  try {
    if (data.type === "TRANSFER") {
      if (data.sourceAccountId === data.destinationAccountId) {
        return { error: "Akun asal dan tujuan tidak boleh sama" };
      }
      if (!(await assertOwnsAccounts(userId, [data.sourceAccountId, data.destinationAccountId]))) {
        return { error: "Akun tidak ditemukan" };
      }
      const [tx] = await db
        .insert(transactions)
        .values({
          userId,
          accountId: data.sourceAccountId,
          type: "TRANSFER",
          amount: data.amount,
          transactionDate: date,
          description: data.description ?? "",
          notes: data.notes ?? "",
        })
        .returning();
      await db.insert(transfers).values({
        userId,
        transactionId: tx.id,
        sourceAccountId: data.sourceAccountId,
        destinationAccountId: data.destinationAccountId,
      });
      await uploadReceiptIfAny(userId, tx.id, formData);
    } else {
      const accountId = data.accountId!;
      // Discriminated union: categoryId only on income/expense, contactId only on loan types.
      const categoryId = "categoryId" in data ? data.categoryId : undefined;
      const rawContactId = "contactId" in data ? data.contactId : undefined;
      if (!(await assertOwnsAccounts(userId, [accountId]))) return { error: "Akun tidak ditemukan" };
      if (!(await assertOwnsCategory(userId, categoryId))) return { error: "Kategori tidak ditemukan" };

      let contactId: string | null = null;
      if (isLoanType(data.type)) {
        const resolved = await resolveContact(
          userId,
          rawContactId,
          (formData.get("contactName") as string) ?? undefined
        );
        if (resolved.error) return { error: resolved.error };
        contactId = resolved.id!;
        const guard = await assertLoanAmountValid(userId, data.type, contactId, data.amount);
        if (guard) return { error: guard };
      }

      const [tx] = await db
        .insert(transactions)
        .values({
          userId,
          accountId,
          type: data.type,
          amount: data.amount,
          categoryId,
          contactId,
          transactionDate: date,
          description: data.description ?? "",
          notes: data.notes ?? "",
        })
        .returning();
      await uploadReceiptIfAny(userId, tx.id, formData);

      const origin = ledgerTypeOf(data.type);
      if (contactId && origin) await syncLoanLedger(userId, contactId, origin);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan transaksi. Silakan coba lagi." };
  }

  for (const p of REVALIDATE) revalidatePath(p);
  redirect("/transactions");
}

export async function updateTransactionAction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUser();
  const existing = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
  });
  if (!existing) return { error: "Transaksi tidak ditemukan" };

  const type = String(formData.get("type") ?? existing.type) as TxType;
  const input = {
    type,
    amount: parseAmountInput(formData.get("amount")) ?? existing.amount,
    description: (formData.get("description") as string) ?? existing.description,
    notes: (formData.get("notes") as string) ?? existing.notes,
    date: (formData.get("date") as string) ?? existing.transactionDate.toISOString().slice(0, 10),
    accountId: (formData.get("accountId") as string) ?? "",
    categoryId: (formData.get("categoryId") as string) ?? "",
    sourceAccountId: (formData.get("sourceAccountId") as string) ?? "",
    destinationAccountId: (formData.get("destinationAccountId") as string) ?? "",
    contactId: (formData.get("contactId") as string) ?? "",
  };

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const data = parsed.data;
  if (data.type !== existing.type) {
    return { error: "Tipe transaksi tidak bisa diubah. Hapus lalu catat ulang." };
  }
  const date = new Date(`${data.date}T12:00:00`);

  try {
    if (data.type === "TRANSFER") {
      if (data.sourceAccountId === data.destinationAccountId) {
        return { error: "Akun asal dan tujuan tidak boleh sama" };
      }
      if (!(await assertOwnsAccounts(userId, [data.sourceAccountId, data.destinationAccountId]))) {
        return { error: "Akun tidak ditemukan" };
      }
      await db
        .update(transactions)
        .set({
          accountId: data.sourceAccountId,
          amount: data.amount,
          transactionDate: date,
          description: data.description ?? "",
          notes: data.notes ?? "",
        })
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
      const transfer = await db.query.transfers.findFirst({
        where: eq(transfers.transactionId, id),
      });
      if (transfer) {
        await db
          .update(transfers)
          .set({
            sourceAccountId: data.sourceAccountId,
            destinationAccountId: data.destinationAccountId,
          })
          .where(eq(transfers.transactionId, id));
      }
      await uploadReceiptIfAny(userId, id, formData);
    } else {
      const accountId = data.accountId!;
      const categoryId = "categoryId" in data ? data.categoryId : undefined;
      const rawContactId = "contactId" in data ? data.contactId : undefined;
      if (!(await assertOwnsAccounts(userId, [accountId]))) return { error: "Akun tidak ditemukan" };
      if (!(await assertOwnsCategory(userId, categoryId))) return { error: "Kategori tidak ditemukan" };

      let contactId: string | null = null;
      if (isLoanType(data.type)) {
        const resolved = await resolveContact(
          userId,
          rawContactId,
          (formData.get("contactName") as string) ?? undefined
        );
        if (resolved.error) return { error: resolved.error };
        contactId = resolved.id ?? null;
      }

      if (contactId && isLoanType(data.type)) {
        const guard = await assertLoanAmountValid(userId, existing.type, contactId, data.amount);
        if (guard) return { error: guard };
      }

      await db
        .update(transactions)
        .set({
          accountId,
          type: data.type,
          amount: data.amount,
          categoryId,
          contactId,
          transactionDate: date,
          description: data.description ?? "",
          notes: data.notes ?? "",
        })
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
      if (existing.type === "TRANSFER") {
        await db.delete(transfers).where(eq(transfers.transactionId, id));
      }

      // Replace receipt if a new file was provided (PRD #32 edit includes receipt).
      const newFile = formData.get("receipt");
      if (newFile instanceof File && newFile.size > 0) {
        await removeReceiptFiles(userId, id);
        await uploadReceiptIfAny(userId, id, formData);
      }

      const origin = ledgerTypeOf(data.type);
      if (contactId && origin) await syncLoanLedger(userId, contactId, origin);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan transaksi. Silakan coba lagi." };
  }

  for (const p of REVALIDATE) revalidatePath(p);
  redirect("/transactions");
}

export async function deleteTransactionAction(id: string): Promise<ActionState> {
  const userId = await requireUser();
  const existing = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
  });
  if (!existing) return { error: "Transaksi tidak ditemukan" };

  await removeReceiptFiles(userId, id);
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (isLoanType(existing.type) && existing.contactId) {
    const origin = ledgerTypeOf(existing.type);
    if (origin) await syncLoanLedger(userId, existing.contactId, origin);
  }

  for (const p of REVALIDATE) revalidatePath(p);
  return {};
}