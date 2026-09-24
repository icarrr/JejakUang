import fs from "node:fs";
import path from "node:path";
import { del as blobDelete, put as blobPut } from "@vercel/blob";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 MB (PRD #23)

export function validateReceiptFile(file: File): string | null {
  if (!file.type) return "Format struk harus JPG, JPEG, PNG, atau WEBP";
  if (!ALLOWED_MIME.has(file.type)) return "Format struk harus JPG, JPEG, PNG, atau WEBP";
  if (file.size === 0) return "File struk kosong";
  if (file.size > MAX_RECEIPT_SIZE) return "Ukuran struk maksimal 5 MB";
  return null;
}

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Storage abstraction (PRD #24): swap provider without touching txn logic. */
export interface ReceiptStorage {
  put(file: File): Promise<{ url: string }>;
  remove(url: string): Promise<void>;
}

const localStorage: ReceiptStorage = {
  async put(file) {
    const dir = path.join(process.cwd(), "public", "uploads");
    await fs.promises.mkdir(dir, { recursive: true });
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extFor(file.type)}`;
    await fs.promises.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
    return { url: `/uploads/${fileName}` };
  },
  async remove(url) {
    if (!url.startsWith("/uploads/")) return;
    await fs.promises.unlink(path.join(process.cwd(), "public", url)).catch(() => {});
  },
};

const blobToken = () =>
  process.env.STORAGE_BLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;

/** fileUrl is the authed proxy path; the row's fileName is the blob pathname. */
const blobStorage: ReceiptStorage = {
  async put(file) {
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extFor(file.type)}`;
    await blobPut(fileName, file, { access: "private", token: blobToken() });
    return { url: `/api/receipts/${fileName}` };
  },
  async remove(url) {
    const prefix = "/api/receipts/";
    if (!url.startsWith(prefix)) return;
    await blobDelete(url.slice(prefix.length), { token: blobToken() }).catch(() => {});
  },
};

export function storage(): ReceiptStorage {
  return process.env.STORAGE_DRIVER === "blob" ? blobStorage : localStorage;
}