"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { registerAction, type ActionState } from "@/actions/auth";
import { SubmitButton } from "@/components/forms";

export default function RegisterForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(registerAction, {});
  const params = useSearchParams();
  const registered = params.get("registered") === "1";

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Daftar</h1>
      <p className="-mt-3 text-sm text-neutral-500">
        Mulai catat uangmu hari ini. Gratis, sederhana.
      </p>
      {registered && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Akun berhasil dibuat. Silakan masuk.
        </p>
      )}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nama</span>
        <input
          name="name"
          required
          autoComplete="name"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
        <span className="mt-1 block text-xs text-neutral-400">Minimal 8 karakter.</span>
      </label>
      <SubmitButton className="w-full">Daftar</SubmitButton>
      <p className="text-center text-sm text-neutral-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-emerald-700 hover:underline">
          Masuk
        </Link>
      </p>
    </form>
  );
}