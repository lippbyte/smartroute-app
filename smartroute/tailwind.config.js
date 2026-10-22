/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Font app (variable font, dimuat di app/_layout.tsx). Dipakai untuk
      // TextInput — komponen Text app sudah memasangnya sendiri.
      fontFamily: { jakarta: ["Plus-Jakarta-Sans"] },
      colors: {
        // 0. Palet desain (Figma "Collection 1", 22 Sep 2026). Permukaan kartu
        //    memakai Light / Light Gelap 1 / Light Gelap 2 sebagai pengganti
        //    abu gelap lama (dark-2/dark-4); teks di atasnya ink/ink-2/muted.
        surface: { DEFAULT: "#F8FAFC", 2: "#F4F4F0" }, // Light, Light Gelap 1
        line: "#D4D4D4", // Light Gelap 2 — garis, pembatas, elemen non-aktif
        muted: "#737373", // Light Gelap 3 — teks sekunder
        ink: { DEFAULT: "#0A0A0A", 2: "#404040" }, // Dark, Dark Terang
        brand: {
          blue: "#0F3FC1", // Primary 1
          "blue-dark": "#0F3F80", // Primary 1 Gelap
          green: "#018959", // Primary 2
          "green-light": "#AAE3BA", // Primary 2 Terang
          orange: "#FC9D33", // Accent
        },

        // 1. Dark (Kontras Tinggi: Sangat Gelap -> Gelap -> Sedang)
        dark: {
          1: "#18181B", // Zinc-900 → Teks gelap (soft black, bukan pure black)
          2: "#27272A", // Zinc-800 → Card sekunder (HistoryCard) — kontras jelas dari bg
          3: "#1C1C1E", // iOS System Background → Background utama halaman (elegan, tidak mati)
          4: "#3F3F46", // Zinc-700 → Tombol non-aktif / inner element — cukup terang agar terasa interaktif
        },

        // 2. Light (Kontras Tinggi: Putih Murni -> Abu Muda -> Abu Sedang)
        light: {
          1: "#FFFFFF", // Pure White (Card Utama)
          2: "#E2E8F0", // Soft Gray / Off-White (Background Halaman)
          3: "#94A3B8", // Slate Gray (Input / Border / Container Muted)
        },

        // 3. Primary (Warna Utama Brand)
        primary: {
          DEFAULT: "#3B82F6", // Bright Royal Blue (Tailwind Blue-500) — Cerah, modern, sangat terbaca di dark bg
          emerald: "#10B981", // Vibrant Emerald (Tailwind Emerald-500) — Hijau aksi yang "hidup" dan inviting
          mint: "#6EE7B7", // Soft Bright Mint (Tailwind Emerald-300) — Pastel yang cukup terang untuk teks/badge di bg gelap
        },

        // 4. Accent (Status & Indikator)
        accent: {
          DEFAULT: "#F59E0B",
          orange: "#F59E0B",
          green: "#00B074",
          red: "#DC2626",
        },
      },
    },
  },
  plugins: [],
};
