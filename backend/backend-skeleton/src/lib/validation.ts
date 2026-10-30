// Zod mirrors of the request body / RouteRecommendation contract from
// src/types/schema.ts. Kept separate from schema.ts on purpose — schema.ts
// stays the frozen plain-TypeScript contract from Task Backend-01, this file
// is the runtime validator layered on top of it (Task Backend-03 AC:
// "Response selalu valid sesuai skema RouteRecommendation, validasi pakai
// Zod atau setara").
import { z } from "zod";

export const CoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const RoutesRequestSchema = z.object({
  origin: CoordinateSchema,
  destination: CoordinateSchema,
  // Optional pin for the itinerary search time (Task Backend-03b found route
  // results are genuinely time-of-day sensitive — real TransJakarta schedule
  // behavior, not a bug). Requires an explicit offset (Z or ±HH:mm) since
  // that's what OTP2's OffsetDateTime scalar expects; omitted -> "now".
  // Deliberately not validated for "sensible" past/future range — an
  // out-of-schedule-range value should just come back as routes: [] from
  // OTP2, not get rejected at this layer.
  departure_time: z.iso.datetime({ offset: true }).optional(),
  // Filter moda (chip "Bus/KRL/MRT/LRT" di layar hasil): hanya moda transit
  // OTP2 ini yang boleh dipakai; jalan kaki selalu boleh. Kosong/tidak ada =
  // semua moda, sama seperti sebelum filter ini ada.
  modes: z.array(z.enum(["BUS", "RAIL", "SUBWAY", "TRAM"])).optional(),
  // Hari 3 Task 1: info aksesibilitas opt-in. Hanya "kursi_roda"; nilai lain
  // -> 400. Tidak dikirim = perilaku lama persis.
  accessibility: z.array(z.enum(["kursi_roda"])).max(1).optional(),
});

export type RoutesRequest = z.infer<typeof RoutesRequestSchema>;

const RouteLegSchema = z.object({
  mode: z.enum(["WALK", "BUS", "RAIL", "SUBWAY", "TRAM"]),
  route_name: z.string().optional(),
  route_category: z.string().optional(),
  from: z.string(),
  to: z.string(),
  // Wajib dideklarasikan: z.object membuang kunci yang tidak dikenal, jadi
  // tanpa baris-baris ini data navigasi hilang diam-diam sebelum respons
  // dikirim.
  from_coord: z.object({ lat: z.number(), lng: z.number() }).optional(),
  to_coord: z.object({ lat: z.number(), lng: z.number() }).optional(),
  headsign: z.string().optional(),
  path: z.array(z.tuple([z.number(), z.number()])).optional(),
  stops_passed: z.array(z.object({ name: z.string(), lat: z.number(), lng: z.number() })).optional(),
  walk_steps: z
    .array(
      z.object({
        distance_m: z.number(),
        direction: z.string(),
        street: z.string(),
        lat: z.number(),
        lng: z.number(),
      }),
    )
    .optional(),
  depart_at: z.string().optional(),
  arrive_at: z.string().optional(),
  distance_m: z.number().optional(),
});

const RouteCandidateSchema = z.object({
  route_id: z.string(),
  legs: z.array(RouteLegSchema).min(1),
  travel_time_minutes: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }),
  transfer_count: z.number().int().nonnegative(),
  walking_distance_m: z.number().nonnegative(),
  cost_idr: z.number().nonnegative(),
  // Left optional and unset by this task on purpose — filled by Task
  // Backend-04 (crowd_level) and Task Backend-05 (reliability).
  crowd_level: z.enum(["low", "moderate", "high"]).optional(),
  reliability: z
    .object({
      score: z.number(),
      risk: z.enum(["low", "medium", "high"]),
    })
    .optional(),
  // Task Backend-06: combined ranking score. Always present (not optional
  // like crowd_level/reliability above) — the formula defines a neutral
  // fallback for every component, so there's always a number to give.
  recommendation_score: z.number(),
  // Hari 2 Task 1: WAJIB didaftarkan di sini — z.object membuang kunci yang
  // tidak dikenal, jadi tanpa baris-baris ini field CO₂ hilang diam-diam
  // sebelum respons dikirim. Semua opsional (additive).
  co2_estimate_g: z.number().nonnegative().optional(),
  co2_by_mode: z.partialRecord(z.enum(["WALK", "BUS", "RAIL", "SUBWAY", "TRAM"]), z.number().nonnegative()).optional(),
  co2_car_g: z.number().nonnegative().optional(),
  co2_motorcycle_g: z.number().nonnegative().optional(),
  co2_comparator_distance_m: z.number().nonnegative().optional(),
  co2_basis: z.literal("estimasi").optional(),
  co2_factors_version: z.string().optional(),
  // Hari 3 Task 1: info aksesibilitas (opt-in) — WAJIB didaftarkan di sini,
  // kalau tidak dibuang Zod sebelum respons dikirim (pelajaran Hari 2).
  accessibility_confidence: z.enum(["tinggi", "sedang", "rendah", "tidak_diketahui"]).optional(),
  accessibility_summary: z.string().optional(),
  accessibility_points: z
    .array(
      z.object({
        stop_id: z.string().nullable(),
        name: z.string(),
        role: z.enum(["naik", "turun", "transfer"]),
        mode: z.string(),
        status: z.enum(["bisa", "tidak_bisa", "tidak_diketahui"]),
      }),
    )
    .optional(),
  accessibility_trip_data: z.enum(["lengkap", "sebagian", "tidak_ada"]).optional(),
  accessibility_basis: z.literal("data_gtfs").optional(),
});

export const RouteRecommendationSchema = z.object({
  request_id: z.string(),
  origin: z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
  destination: z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
  routes: z.array(RouteCandidateSchema),
  // Echoes the departure time actually used for this search — either the
  // request's departure_time, or "now" at request time if omitted. Added by
  // Task Backend-03c so a rehearsal/demo run can prove which schedule
  // window a given result came from.
  departure_time: z.iso.datetime({ offset: true }),
  generated_at: z.string(),
});

// Task Backend-04: POST /crowd-reports body. No auth/spam protection by
// design (explicit MVP scope cut, see README known limitations) — this only
// validates shape, not who's sending it.
export const CrowdReportRequestSchema = z.object({
  stop_id: z.string().min(1),
  level: z.enum(["low", "moderate", "high"]),
});

export type CrowdReportRequest = z.infer<typeof CrowdReportRequestSchema>;

// Task Backend-06: POST /assistant/ask body. `context` is optional — only
// present when the caller already has a specific origin/destination in mind
// (e.g. frontend follow-up chat after a /routes search) so the assistant can
// ground its answer in real computed route candidates instead of just the
// general GTFS route list.
export const AssistantAskRequestSchema = z.object({
  question: z.string().min(1, "question tidak boleh kosong"),
  context: z
    .object({
      origin: CoordinateSchema.optional(),
      destination: CoordinateSchema.optional(),
      // Posisi GPS user saat bertanya — dasar jawaban "halte terdekat".
      user_location: CoordinateSchema.optional(),
    })
    .optional(),
  // Beberapa giliran terakhir supaya pertanyaan lanjutan ("yang kedua
  // gimana ke sana?") bisa dipahami. Dibatasi supaya prompt tidak membengkak.
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .max(10)
    .optional(),
});

export type AssistantAskRequest = z.infer<typeof AssistantAskRequestSchema>;

// Hari 1 Task 1/3: akun, preferensi, riwayat, rating. Pesan galat per field
// berbahasa Indonesia karena app menampilkannya langsung di bawah field.

// Label disamakan dengan chip kriteria di layar hasil ("Tenang", bukan
// "Nyaman" — keputusan Task 0 no. 2a). "sehat" ditambahkan Hari 2 Task 4:
// hanya disimpan + konteks TOTO, belum mengubah urutan hasil.
export const PRIORITIES = ["cepat", "murah", "tenang", "sehat"] as const;
export const WALK_LIMITS = ["dekat", "sedang", "jauh"] as const;
// Sama dengan chip moda di layar hasil (Bus/KRL/MRT/LRT).
export const AVOIDABLE_MODES = ["bus", "krl", "mrt", "lrt"] as const;
export const ACCESSIBILITY_NEEDS = ["kursi_roda", "low_vision", "tunarungu", "kognitif", "lansia_anak"] as const;

// Hari 1 hanya DISIMPAN — belum memengaruhi routing/scoring backend.
// TODO:verifikasi cara menerapkan walk_limit & avoid_modes tanpa mengubah
// scoring /routes.
export const PreferencesSchema = z
  .object({
    priority: z.enum(PRIORITIES).nullable().optional(),
    walk_limit: z.enum(WALK_LIMITS).nullable().optional(),
    avoid_modes: z.array(z.enum(AVOIDABLE_MODES)).max(AVOIDABLE_MODES.length).optional(),
  })
  .strict();

export type Preferences = z.infer<typeof PreferencesSchema>;

// Data pribadi sensitif: hanya diterima bersama persetujuan eksplisit.
export const AccessibilitySchema = z.object({
  needs: z.array(z.enum(ACCESSIBILITY_NEEDS)).min(1, "Pilih minimal satu kebutuhan.").max(ACCESSIBILITY_NEEDS.length),
  consent: z.literal(true, "Persetujuan wajib dicentang untuk menyimpan data ini."),
});

export const RegisterRequestSchema = z.object({
  email: z.email("Format email tidak valid.").max(254, "Email terlalu panjang."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(200, "Kata sandi terlalu panjang."),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(60, "Nama maksimal 60 karakter."),
  preferences: PreferencesSchema.optional(),
  accessibility: AccessibilitySchema.optional(),
});

export const LoginRequestSchema = z.object({
  email: z.string().min(1, "Email wajib diisi.").max(254),
  password: z.string().min(1, "Kata sandi wajib diisi.").max(200),
});

const MinuteRangeSchema = z
  .object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() })
  .refine((r) => r.min <= r.max, "min tidak boleh lebih besar dari max.");

export const TripCreateRequestSchema = z
  .object({
    // Pengenal dari app untuk kirim ulang yang aman (idempoten per pengguna).
    client_ref: z.string().min(8).max(64).optional(),
    origin_label: z.string().trim().min(1).max(200),
    destination_label: z.string().trim().min(1).max(200),
    route_summary: z.object({
      legs: z
        .array(
          z.object({
            mode: z.string().min(1).max(30),
            service: z.string().max(80).optional(),
            from: z.string().max(200),
            to: z.string().max(200),
          }),
        )
        .min(1)
        .max(20),
      transfers: z.number().int().min(0).max(20),
      walking_distance_m: z.number().min(0).max(100_000),
    }),
    predicted_min_range: MinuteRangeSchema.nullable(),
    actual_duration_min: z.number().int().min(0).max(24 * 60).nullable(),
    duration_basis: z.enum(["aktual", "estimasi"]),
    fare_total: z.number().int().min(0).max(1_000_000),
    co2_estimate_g: z.number().int().min(0).nullable().optional(), // diisi Hari 2
  })
  // "Jangan pernah melabeli estimasi sebagai aktual" — ditegakkan di server
  // juga, bukan hanya di app.
  .refine(
    (t) => (t.duration_basis === "aktual") === (t.actual_duration_min !== null),
    "actual_duration_min wajib diisi bila duration_basis 'aktual', dan wajib null bila 'estimasi'.",
  );

export const RatingRequestSchema = z.object({
  stars: z.number().int().min(1, "Rating harus 1–5.").max(5, "Rating harus 1–5."),
  eta_accurate: z.boolean().nullable().optional(),
  transfer_risk_accurate: z.boolean().nullable().optional(),
  crowd_accurate: z.boolean().nullable().optional(),
  message: z.string().trim().max(500, "Pesan maksimal 500 karakter.").nullable().optional(),
});
