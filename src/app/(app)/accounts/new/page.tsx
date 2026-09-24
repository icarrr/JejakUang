import Link from "next/link";
import { AccountForm } from "@/components/account-form";
import { createAccountAction } from "@/actions/account";

export const dynamic = "force-dynamic";

export default function NewAccountPage() {
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tambah Akun</h1>
        <Link href="/accounts" className="text-sm font-medium text-emerald-700 hover:underline">
          Kembali
        </Link>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <AccountForm action={createAccountAction} submitLabel="Simpan Akun" />
      </div>
    </div>
  );
}