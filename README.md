# JejakUang

> Tahu uangmu pergi ke mana.

Aplikasi web pencatatan keuangan pribadi yang sederhana. Catat transaksi harian, bedakan jenis transaksi (income / expense / transfer), dan pahami pola pengeluaranmu.

## Stack

- Next.js (App Router) · React · TypeScript · Tailwind CSS
- Drizzle ORM · Neon PostgreSQL
- NextAuth v5 (credentials + JWT session)

## Fitur (MVP)

- Registrasi / login / logout
- Akun keuangan: buat, edit, nonaktifkan (non-destructive)
- Kategori: bawaan otomatis saat registrasi, custom (buat/edit/nonaktifkan)
- Transaksi: pengeluaran, pemasukan, transfer, edit, hapus (dengan konfirmasi)
  - Transfer tidak masuk laporan income/expense
- Riwayat: paginasi 20/halaman, filter per akun
- Dashboard: total saldo, pemasukan/pengeluaran bulan berjalan, selisih, kategori terbesar, transaksi terbaru, navigasi antar bulan

## Setup

```bash
npm install
cp .env.example .env.local
```

Isi `.env.local`:

```
DATABASE_URL=<connection string Neon PostgreSQL>
AUTH_SECRET=<openssl rand -base64 32>
```

### Database

```bash
npm run db:generate   # buat file migrasi dari schema
npm run db:migrate    # terapkan migrasi ke database
```

> Development gunakan database Neon terpisah, jangan database production.

### Menjalankan

```bash
npm run dev
```

Buka http://localhost:3000, daftar akun, tambah akun keuangan, lalu mulai mencatat.

## Production

Deploy ke Vercel. Set `DATABASE_URL` dan `AUTH_SECRET` di environment variables. Setiap push ke branch production akan auto-deploy.

## Verifikasi

```bash
npm run lint          # eslint, 0 error/warning
npx tsc --noEmit      # type check
npm run build         # production build
npx tsx src/lib/balance.selfcheck.ts   # self-check engine saldo (PRD #10/#43)
```

## Rencana

- **Phase 2:** struk, pinjaman/hutang, kontak, pencarian, filter, transaksi berulang
- **Phase 3:** perbandingan bulanan, budget, chart, export CSV, PWA

Detail lengkap: [docs/PRD-1.0.1.md](docs/PRD-1.0.1.md)