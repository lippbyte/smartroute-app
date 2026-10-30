// Hari 2 Task 3: sumber layar "Tentang angka ini" di app. Publik (tanpa
// login). Membaca LANGSUNG dari services/emissionFactors.ts, jadi angka yang
// dijelaskan ke pengguna selalu sama dengan angka yang dipakai menghitung.
import { Router } from "express";
import { COMPARATORS, FACTORS_VERSION, LEG_FACTORS } from "../services/emissionFactors";

const router = Router();

router.get("/emission-factors", (_req, res) => {
  res.status(200).json({
    version: FACTORS_VERSION,
    unit: "gram CO₂e per penumpang-km",
    basis: "estimasi",
    modes: Object.values(LEG_FACTORS),
    comparators: Object.values(COMPARATORS),
    notes: [
      "Semua angka CO₂ di SmartRoute adalah estimasi, bukan hasil pengukuran.",
      "CO₂ rute = jumlah (jarak tiap bagian rute × faktor modanya). Jarak per bagian dari mesin rute (OTP2).",
      "Pembanding mobil/motor memakai jarak proksi: jumlah jarak semua bagian rute, termasuk jalan kaki. Jarak jalan raya sebenarnya bisa berbeda.",
      "Hasil dibulatkan ke puluhan gram.",
      "Faktor bertanda belum terverifikasi masih menunggu pemeriksaan sumber primer.",
    ],
  });
});

export default router;
