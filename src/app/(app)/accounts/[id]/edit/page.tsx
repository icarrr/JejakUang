import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { moneyAccounts } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { AccountForm } from "@/components/account-form";
import { updateAccountAction } from "@/actions/account";
import { DeactivateAccountButton } from "@/components/deactivate-button";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUser();
  const { id } = await params;
  const account = await db.query.moneyAccounts.findFirst({
    where: and(eq(moneyAccounts.id, id), eq(moneyAccounts.userId, userId)),
  });
  if (!account) notFound();

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Akun</h1>
        <Link href="/accounts" className="text-sm font-medium text-emerald-700 hover:underline">
          Kembali
        </Link>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <AccountForm
          existing={{
            id: account.id,
            name: account.name,
            type: account.type,
            initialBalance: account.initialBalance,
          }}
          action={updateAccountAction.bind(null, id)}
          submitLabel="Simpan Perubahan"
        />
      </div>
      {account.isActive && (
        <div className="flex justify-center">
          <DeactivateAccountButton id={account.id} name={account.name} />
        </div>
      )}
    </div>
  );
}