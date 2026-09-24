"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth";

const DESKTOP_NAV = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/transactions", label: "Transaksi", icon: "📋" },
  { href: "/accounts", label: "Akun", icon: "👛" },
  { href: "/loans", label: "Pinjaman", icon: "🤝" },
  { href: "/reports", label: "Laporan", icon: "📊" },
  { href: "/settings", label: "Pengaturan", icon: "⚙️" },
];

const MOBILE_NAV = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/transactions", label: "Riwayat", icon: "📋" },
  { href: "/transactions/new", label: "Catat", icon: "➕", primary: true },
  { href: "/accounts", label: "Akun", icon: "👛" },
  { href: "/settings", label: "Lainnya", icon: "⋯" },
];

function NavLinks({ items }: { items: (typeof DESKTOP_NAV)[number][] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-800"
                : "flex items-center gap-2 px-3 py-2 text-neutral-600 hover:bg-neutral-100"
            }
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function NavShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-neutral-200 bg-white px-4 py-6 md:flex">
        <Link href="/" className="mb-6 px-3">
          <span className="text-xl font-bold tracking-tight text-emerald-700">JejakUang</span>
        </Link>
        <Link
          href="/transactions/new"
          className="mb-6 block rounded-lg bg-emerald-700 px-3 py-2.5 text-center font-semibold text-white hover:bg-emerald-800"
        >
          + Catat
        </Link>
        <nav className="flex flex-col gap-1">
          <NavLinks items={DESKTOP_NAV} />
        </nav>
        <div className="mt-auto space-y-2 px-3">
          <p className="text-sm text-neutral-500">Halo, {userName}!</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Keluar
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <div className="pb-20 md:ml-56 md:pb-8">
        <main className="mx-auto w-full max-w-2xl px-4 py-6">{children}</main>
      </div>

      {/* Mobile top brand + logout */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="text-lg font-bold tracking-tight text-emerald-700">
          JejakUang
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="text-sm font-medium text-red-600">
            Keluar
          </button>
        </form>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch justify-around border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              item.primary
                ? "text-emerald-700"
                : "text-neutral-500"
            }`}
          >
            <span className={`text-xl leading-none ${item.primary ? "font-bold text-emerald-700" : ""}`}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}