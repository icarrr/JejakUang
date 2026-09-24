import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <Link href="/login" className="mb-8 flex flex-col items-center gap-1">
        <span className="text-3xl font-bold tracking-tight text-emerald-700">
          JejakUang
        </span>
        <span className="text-sm text-neutral-500">Tahu uangmu pergi ke mana</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}