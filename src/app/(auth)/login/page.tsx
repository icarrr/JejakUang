"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/actions/auth";
import { SubmitButton } from "@/components/forms";

export default function LoginPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Masuk</h1>
      <p className="-mt-3 text-sm text-neutral-500">Catat uangmu, pahami ke mana ia pergi.</p>
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
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
          autoComplete="current-password"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <SubmitButton className="w-full">Masuk</SubmitButton>
      <p className="text-center text-sm text-neutral-500">
        Belum punya akun?{" "}
        <a href="/register" className="font-medium text-emerald-700 hover:underline">
          Daftar
        </a>
      </p>
    </form>
  );
}