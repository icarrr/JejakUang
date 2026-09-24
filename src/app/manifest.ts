import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JejakUang — Tahu uangmu pergi ke mana",
    short_name: "JejakUang",
    description: "Catat transaksi harian, pahami pola keuanganmu.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#047857",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}