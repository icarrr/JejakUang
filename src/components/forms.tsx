"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "",
  pendingText = "Menyimpan…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}