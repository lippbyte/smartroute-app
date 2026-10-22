// src/data/mockRoutes.ts
import { ApiResponse } from "@/type";

export const mockApiResponse: ApiResponse = {
  request_id: "REQ-20260902-001",
  timestamp: "2026-09-02T08:00:00+07:00",
  origin: { name: "Stasiun Manggarai", lat: -6.2101, lng: 106.8503 },
  destination: { name: "Bundaran HI", lat: -6.1929, lng: 106.823 },

  recommendation: {
    route_id: "ROUTE-02",
    rank: 1,
    score: 0.92,
    reason: [
      "Paling sedikit crowding",
      "Reliabilitas tinggi",
      "Hanya 1 transit",
    ],
  },

  routes: [
    {
      route_id: "ROUTE-01",
      rank: 2,
      legs: [
        {
          mode: "KRL",
          service: "Bogor Line",
          from: "Manggarai",
          to: "Sudirman",
        },
        { mode: "Walk", from: "Stasiun Sudirman", to: "Stasiun Dukuh Atas" },
        {
          mode: "MRT",
          service: "MRT Jakarta",
          from: "Dukuh Atas",
          to: "Bundaran HI",
        },
      ],
      travel_time_minutes: 24,
      cost_idr: 8000,
      transfers: 1,
      walking_distance_m: 250,
      crowd: {
        current_level: "HIGH",
        predicted_level: "HIGH",
        predicted_occupancy: 88,
      },
      reliability: { score: 0.82, delay_risk: 0.18 },
      comfort_score: 0.65,
      recommendation_score: 0.79,
    },
    {
      route_id: "ROUTE-02",
      rank: 1,
      legs: [
        {
          mode: "KRL",
          service: "Bogor Line",
          from: "Manggarai",
          to: "Dukuh Atas",
        },
        {
          mode: "MRT",
          service: "MRT Jakarta",
          from: "Dukuh Atas",
          to: "Bundaran HI",
        },
      ],
      travel_time_minutes: 27,
      cost_idr: 6000,
      transfers: 1,
      walking_distance_m: 180,
      crowd: {
        current_level: "MEDIUM",
        predicted_level: "MEDIUM",
        predicted_occupancy: 64,
      },
      reliability: { score: 0.94, delay_risk: 0.06 },
      comfort_score: 0.88,
      recommendation_score: 0.92,
    },
    {
      route_id: "ROUTE-03",
      rank: 3,
      legs: [
        { mode: "Walk", from: "Manggarai", to: "Halte Manggarai" },
        {
          mode: "TransJakarta",
          service: "Koridor 4",
          from: "Manggarai",
          to: "Monas",
        },
        {
          mode: "TransJakarta",
          service: "Koridor 1",
          from: "Monas",
          to: "Bundaran HI",
        },
      ],
      travel_time_minutes: 45,
      cost_idr: 3500,
      transfers: 1,
      walking_distance_m: 400,
      crowd: {
        current_level: "LOW",
        predicted_level: "MEDIUM",
        predicted_occupancy: 45,
      },
      reliability: { score: 0.75, delay_risk: 0.25 },
      comfort_score: 0.7,
      recommendation_score: 0.72,
    },
    {
      route_id: "ROUTE-04",
      rank: 4,
      legs: [
        { mode: "Walk", from: "Manggarai", to: "Halte Pasar Genjing" },
        {
          mode: "JakLingko",
          service: "JAK-34",
          from: "Pasar Genjing",
          to: "Rawamangun",
        },
        {
          mode: "TransJakarta",
          service: "Koridor 10",
          from: "Rawamangun",
          to: "Bundaran HI",
        }, // Asumsi rute panjang
      ],
      travel_time_minutes: 65,
      cost_idr: 3500,
      transfers: 2,
      walking_distance_m: 600,
      crowd: {
        current_level: "LOW",
        predicted_level: "LOW",
        predicted_occupancy: 30,
      },
      reliability: { score: 0.6, delay_risk: 0.4 },
      comfort_score: 0.55,
      recommendation_score: 0.58,
    },
    {
      route_id: "ROUTE-05",
      rank: 5,
      legs: [
        { mode: "Walk", from: "Manggarai", to: "Stasiun Manggarai" },
        {
          mode: "KRL",
          service: "Loop Line",
          from: "Manggarai",
          to: "Tanah Abang",
        },
        { mode: "Walk", from: "Tanah Abang", to: "Bundaran HI" }, // Jauh banget jalan kaki, tapi opsi ada
      ],
      travel_time_minutes: 50,
      cost_idr: 5000,
      transfers: 1,
      walking_distance_m: 1200,
      crowd: {
        current_level: "HIGH",
        predicted_level: "HIGH",
        predicted_occupancy: 92,
      },
      reliability: { score: 0.88, delay_risk: 0.12 },
      comfort_score: 0.4,
      recommendation_score: 0.45,
    },
    // src/data/mockRoutes.ts
  ],
};
