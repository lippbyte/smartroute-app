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
