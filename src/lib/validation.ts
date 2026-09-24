import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const amountSchema = z
  .number()
  .int("Nominal harus berupa angka bulat")
  .positive("Nominal harus lebih besar dari 0");

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

const descriptionSchema = z.string().trim().max(300).optional().default("");

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Nama akun wajib diisi").max(100),
  type: z.enum(["CASH", "BANK", "E_WALLET", "CREDIT_CARD", "OTHER"]),
  initialBalance: z.number().int().min(0, "Saldo awal tidak boleh negatif").default(0),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(100),
  type: z.enum(["INCOME", "EXPENSE"]),
  icon: z.string().trim().max(10).default(""),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Nama kontak wajib diisi").max(100),
  phone: z.string().trim().max(30).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "Kategori belum dipilih"),
  amount: amountSchema,
  month: z.string().regex(/^\d{4}-\d{2}$/, "Bulan tidak valid"),
});

const baseTx = {
  amount: amountSchema,
  description: descriptionSchema,
  notes: z.string().trim().max(1000).optional().default(""),
  date: dateStringSchema,
};

export const expenseSchema = z.object({
  ...baseTx,
  type: z.literal("EXPENSE"),
  accountId: z.string().min(1, "Akun belum dipilih"),
  categoryId: z.string().min(1, "Kategori belum dipilih"),
});

export const incomeSchema = z.object({
  ...baseTx,
  type: z.literal("INCOME"),
  accountId: z.string().min(1, "Akun belum dipilih"),
  categoryId: z.string().min(1, "Kategori belum dipilih"),
});

export const transferSchema = z.object({
  ...baseTx,
  type: z.literal("TRANSFER"),
  sourceAccountId: z.string().min(1, "Akun asal belum dipilih"),
  destinationAccountId: z.string().min(1, "Akun tujuan belum dipilih"),
});

const loanBase = {
  ...baseTx,
  contactId: z.string().min(1, "Kontak belum dipilih"),
};

export const loanGivenSchema = z.object({
  ...loanBase,
  type: z.literal("LOAN_GIVEN"),
  accountId: z.string().min(1, "Akun belum dipilih"),
});

export const loanRepaymentSchema = z.object({
  ...loanBase,
  type: z.literal("LOAN_REPAYMENT"),
  accountId: z.string().min(1, "Akun belum dipilih"),
});

export const debtReceivedSchema = z.object({
  ...loanBase,
  type: z.literal("DEBT_RECEIVED"),
  accountId: z.string().min(1, "Akun belum dipilih"),
});

export const debtPaymentSchema = z.object({
  ...loanBase,
  type: z.literal("DEBT_PAYMENT"),
  accountId: z.string().min(1, "Akun belum dipilih"),
});

export const transactionSchema = z.discriminatedUnion("type", [
  expenseSchema,
  incomeSchema,
  transferSchema,
  loanGivenSchema,
  loanRepaymentSchema,
  debtReceivedSchema,
  debtPaymentSchema,
]);

export type TransactionInput = z.infer<typeof transactionSchema>;