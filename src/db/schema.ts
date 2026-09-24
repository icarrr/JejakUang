import { relations } from "drizzle-orm";
import {
  boolean as booleanCol,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", [
  "CASH",
  "BANK",
  "E_WALLET",
  "CREDIT_CARD",
  "OTHER",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "LOAN_GIVEN",
  "LOAN_REPAYMENT",
  "DEBT_RECEIVED",
  "DEBT_PAYMENT",
]);

export const categoryTypeEnum = pgEnum("category_type", ["INCOME", "EXPENSE"]);

export const loanTypeEnum = pgEnum("loan_type", ["LOAN_GIVEN", "DEBT_RECEIVED"]);

export const loanStatusEnum = pgEnum("loan_status", ["OPEN", "CLOSED"]);

/* ── Auth.js tables ─────────────────────────────────────────────── */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<string>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: { name: "accounts_pk", columns: [t.provider, t.providerAccountId] },
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    pk: { name: "verification_tokens_pk", columns: [t.identifier, t.token] },
  })
);

/* ── Domain tables ──────────────────────────────────────────────── */

export const moneyAccounts = pgTable(
  "money_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull().default("CASH"),
    initialBalance: integer("initial_balance").notNull().default(0),
    isActive: booleanCol("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("money_accounts_user_id_idx").on(t.userId)]
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: categoryTypeEnum("type").notNull(),
    icon: text("icon").notNull().default(""),
    isDefault: booleanCol("is_default").notNull().default(false),
    isActive: booleanCol("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("categories_user_id_idx").on(t.userId)]
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("contacts_user_id_idx").on(t.userId)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => moneyAccounts.id, { onDelete: "restrict" }),
    type: transactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    contactId: uuid("contact_id").references(() => contacts.id),
    transactionDate: timestamp("transaction_date", { mode: "date" })
      .notNull()
      .defaultNow(),
    description: text("description").notNull().default(""),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("transactions_user_id_idx").on(t.userId),
    index("transactions_date_idx").on(t.transactionDate),
    index("transactions_account_id_idx").on(t.accountId),
    index("transactions_category_id_idx").on(t.categoryId),
    index("transactions_contact_id_idx").on(t.contactId),
    index("transactions_type_idx").on(t.type),
  ]
);

export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    sourceAccountId: uuid("source_account_id")
      .notNull()
      .references(() => moneyAccounts.id, { onDelete: "restrict" }),
    destinationAccountId: uuid("destination_account_id")
      .notNull()
      .references(() => moneyAccounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("transfers_user_id_idx").on(t.userId),
    index("transfers_transaction_id_idx").on(t.transactionId),
    index("transfers_destination_account_id_idx").on(t.destinationAccountId),
  ]
);

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contacts.id),
    type: loanTypeEnum("type").notNull(),
    amount: integer("amount").notNull().default(0),
    remainingAmount: integer("remaining_amount").notNull().default(0),
    status: loanStatusEnum("status").notNull().default("OPEN"),
    dueDate: timestamp("due_date", { mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("loans_user_id_idx").on(t.userId),
    index("loans_contact_id_idx").on(t.contactId),
    uniqueIndex("loans_user_contact_type_uq").on(t.userId, t.contactId, t.type),
  ]
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("receipts_user_id_idx").on(t.userId),
    index("receipts_transaction_id_idx").on(t.transactionId),
  ]
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    amount: integer("amount").notNull(),
    month: varchar("month", { length: 7 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("budgets_user_id_idx").on(t.userId),
    uniqueIndex("budgets_user_category_month_uq").on(t.userId, t.categoryId, t.month),
  ]
);
/* ── Relations (relational query helper) ────────────────────────── */

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, { fields: [contacts.userId], references: [users.id] }),
}));

export const loansRelations = relations(loans, ({ one }) => ({
  contact: one(contacts, { fields: [loans.contactId], references: [contacts.id] }),
  user: one(users, { fields: [loans.userId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  contact: one(contacts, { fields: [transactions.contactId], references: [contacts.id] }),
  account: one(moneyAccounts, { fields: [transactions.accountId], references: [moneyAccounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));
