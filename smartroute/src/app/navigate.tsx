// src/app/navigate.tsx (MULTIPLATFORM - MOBILE & WEB)
//
// Navigasi ala Google Maps:
// - Peta memakai geometri & koordinat halte ASLI dari backend (OTP2) — dulu
//   posisi halte dicari ulang lewat nama ke Nominatim dan garis bus digambar
//   router mobil (OSRM), sehingga bisa melenceng dari halte sebenarnya.
// - Garis berwarna per moda (jalan kaki putus-putus), titik naik/turun dan
//   halte yang dilewati bernama.
// - Banner instruksi di atas: belokan berikutnya saat jalan kaki, "Naik X
//   arah Y" lalu "Turun di Z · N halte lagi" saat naik transit.
// - Langkah berpindah OTOMATIS saat GPS tiba di ujung leg; tombol manual
//   tetap ada (untuk demo tanpa bergerak).
import ArrivalCelebration from "@/components/navigate/ArrivalCelebration";
import NavBanner from "@/components/navigate/NavBanner";
import NavigateMap, { NavigateMapHandle } from "@/components/navigate/NavigateMap";
import type { MapSegment, MapStop } from "@/components/navigate/navigateMapTypes";
import NavPanel from "@/components/navigate/NavPanel";
import { legModeStyle } from "@/components/transit/legModes";
import Text from "@/components/Text";
import { getRoute } from "@/services/routeStore";
import { haversineM, isWalkLeg, LatLng, legDurationMin } from "@/utils/navInstructions";
import { computeLegProgress, legPath, nearestVertex } from "@/utils/navProgress";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";

// Tiba di ujung leg (pindah ke langkah berikutnya). Transit lebih longgar:
// GPS di dalam kereta/bus sering meleset lebih jauh.
const WALK_LEG_END_RADIUS_M = 35;
const TRANSIT_LEG_END_RADIUS_M = 90;
// Di tengah rentang 50-100m (Task App-13) — cukup longgar untuk akurasi GPS
// HP di area urban, tapi tidak "tiba" padahal masih beberapa blok jauhnya.
const ARRIVAL_RADIUS_METERS = 75;
// GPS lebih jauh dari ini dari seluruh rute = user tidak sedang menjalani
// rute ini (mis. membuka dari laptop di rumah) — peta tidak otomatis
// mengikuti posisinya.
const FOLLOW_NEAR_ROUTE_M = 1000;

export default function NavigateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stored = getRoute(id);
  const router = useRouter();

  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [bannerHeight, setBannerHeight] = useState(120);
  const [panelHeight, setPanelHeight] = useState(180);

  const mapRef = useRef<NavigateMapHandle>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  // Ref, bukan state: penanda sekali-jalan yang tidak boleh memicu render.
  const hasAutoArrivedRef = useRef(false);
  const hasDecidedFollowRef = useRef(false);

  const legs = stored?.route.legs ?? [];

  // --- Geometri peta dari data backend (dihitung sekali per rute) ---
  const { segments, stops, allPoints } = useMemo(() => {
    const segs: MapSegment[] = [];
    const pts: MapStop[] = [];
    legs.forEach((leg, i) => {
      const path = legPath(leg);
      const color = legModeStyle(leg.mode).color;
      segs.push({
        coords: path.map((p) => [p.longitude, p.latitude]),
        color: isWalkLeg(leg) ? "#404040" : color,
        dashed: isWalkLeg(leg),
      });
      if (isWalkLeg(leg)) return;
      if (leg.from_coord)
        pts.push({ ...leg.from_coord, name: leg.from, color, kind: "transfer", legIndex: i });
      for (const s of leg.stops_passed ?? [])
        pts.push({ lat: s.lat, lng: s.lng, name: s.name, color, kind: "pass", legIndex: i });
      if (leg.to_coord)
        pts.push({ ...leg.to_coord, name: leg.to, color, kind: "transfer", legIndex: i });
    });
    const last = legs[legs.length - 1];
    if (last?.to_coord) {
      pts.push({
        ...last.to_coord,
        name: stored?.destinationName ?? last.to,
        color: "#EF4444",
        kind: "destination",
        legIndex: legs.length - 1,
      });
    }
    return {
      segments: segs,
      stops: pts,
      allPoints: segs.flatMap((s) => s.coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const hasMapData = segments.some((s) => s.coords.length >= 2);

  // --- 1. GPS ---
  useEffect(() => {
    let mounted = true;
    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      try {
        const current = await Location.getCurrentPositionAsync({});
        if (mounted)
          setUserLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        locationSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          (loc) => {
            if (mounted)
              setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          },
        );
      } catch (err) {
        console.warn("GPS tidak tersedia:", err);
      }
    };
    startTracking();
    return () => {
      mounted = false;
      locationSubscription.current?.remove();
    };
  }, []);

  // Ikuti posisi user otomatis HANYA kalau user memang berada di sekitar
  // rute. Kalau jauh (demo dari laptop), peta tetap membingkai langkah aktif.
  useEffect(() => {
    if (!userLocation || hasDecidedFollowRef.current || allPoints.length === 0) return;
    hasDecidedFollowRef.current = true;
    const { dist } = nearestVertex(allPoints, userLocation);
    if (dist <= FOLLOW_NEAR_ROUTE_M) setIsFollowingUser(true);
  }, [userLocation, allPoints]);

  const leg = legs[currentLegIndex];
  const progress = useMemo(
    () => (leg ? computeLegProgress(leg, userLocation) : null),
    [leg, userLocation],
  );

  // --- 2. Pindah langkah otomatis & deteksi tiba ---
  useEffect(() => {
    if (!userLocation || isFinished || !leg?.to_coord) return;
    const end = { latitude: leg.to_coord.lat, longitude: leg.to_coord.lng };
    const dist = haversineM(userLocation, end);
    const isLast = currentLegIndex >= legs.length - 1;

    if (isLast) {
      if (dist <= ARRIVAL_RADIUS_METERS && !hasAutoArrivedRef.current) {
        hasAutoArrivedRef.current = true;
        setIsFollowingUser(false);
        setIsFinished(true);
      }
      return;
    }
    const radius = isWalkLeg(leg) ? WALK_LEG_END_RADIUS_M : TRANSIT_LEG_END_RADIUS_M;
    if (dist <= radius) setCurrentLegIndex((i) => Math.min(i + 1, legs.length - 1));
  }, [userLocation, leg, currentLegIndex, legs.length, isFinished]);

  // --- Sisa waktu & jarak (leg aktif dihitung sebagian sesuai posisi GPS) ---
  const { remainingMin, remainingM } = useMemo(() => {
    let min = 0;
    let m = 0;
    legs.forEach((l, i) => {
      if (i < currentLegIndex) return;
      const dur = legDurationMin(l) ?? 0;
      const dist = l.distance_m ?? 0;
      if (i === currentLegIndex && progress?.onRoute) {
        min += dur * (1 - progress.fraction);
        m += progress.remainingM;
      } else {
        min += dur;
        m += dist;
      }
    });
    return { remainingMin: Math.max(1, Math.round(min)), remainingM: m };
  }, [legs, currentLegIndex, progress]);

  // Tombol "Kembali ke Beranda": dismissAll() membuang layar navigasi dari
  // stack supaya tombol back HP tidak masuk lagi ke navigasi yang selesai.
  const handleGoHome = () => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate("/");
  };

  const goToLeg = (i: number) => {
    setIsFollowingUser(false);
    setCurrentLegIndex(Math.max(0, Math.min(i, legs.length - 1)));
  };

  if (!stored || !hasMapData || !leg || !progress) {
    return (
      <View className="flex-1 bg-surface items-center justify-center gap-3 px-8">
        <Ionicons name="warning-outline" size={40} color="#EF4444" />
        <Text className="text-ink text-center font-bold">
          {stored ? "Rute ini tidak punya data peta" : "Data rute sudah tidak tersedia"}
        </Text>
        <Text className="text-muted text-center text-sm">
          Cari ulang rute dari Beranda untuk memulai navigasi.
        </Text>
        <Pressable onPress={handleGoHome} className="bg-brand-blue px-5 py-2.5 rounded-xl mt-2">
          <Text className="text-white font-bold">Ke Beranda</Text>
        </Pressable>
      </View>
    );
  }

  const focusCoords = segments[currentLegIndex]?.coords ?? [];

  return (
    <View className="flex-1 bg-[#18181B]">
      <NavigateMap
        ref={mapRef}
        segments={segments}
        stops={stops}
        activeLegIndex={currentLegIndex}
        focusCoords={focusCoords}
        userLocation={userLocation}
        isFollowingUser={isFollowingUser}
        padding={{ top: bannerHeight + 48, bottom: panelHeight }}
      />

      {!isFinished && (
        <NavBanner
          leg={leg}
          nextLeg={legs[currentLegIndex + 1] ?? null}
          progress={progress}
          isLastLeg={currentLegIndex === legs.length - 1}
          onLayout={(e: LayoutChangeEvent) => setBannerHeight(e.nativeEvent.layout.height)}
        />
      )}

      {/* Tombol ikuti-GPS di kanan, tepat di atas kartu progres (tinggi
          kartu diukur dinamis, bukan angka tebakan — Task App-17). */}
      {!isFinished && (
        <View className="absolute right-4 z-10" style={{ bottom: panelHeight + 14 }}>
          <Pressable
            onPress={() => {
              if (!userLocation) return;
              setIsFollowingUser((f) => !f);
            }}
            accessibilityRole="button"
            accessibilityLabel={isFollowingUser ? "Berhenti mengikuti lokasi" : "Ikuti lokasi saya"}
            className={`w-12 h-12 rounded-full items-center justify-center shadow-lg border ${
              isFollowingUser ? "bg-[#1D4ED8] border-[#1D4ED8]" : "bg-surface border-line"
            }`}
            style={{ opacity: userLocation ? 1 : 0.4 }}
          >
            <Ionicons
              name={isFollowingUser ? "navigate" : "locate-outline"}
              size={22}
              color={isFollowingUser ? "#FFFFFF" : "#0A0A0A"}
            />
          </Pressable>
        </View>
      )}

      {!isFinished && (
        <NavPanel
          route={stored.route}
          currentLegIndex={currentLegIndex}
          currentLegFraction={progress.onRoute ? progress.fraction : 0}
          remainingMin={remainingMin}
          remainingM={remainingM}
          onSelectLeg={goToLeg}
          onPrev={() => goToLeg(currentLegIndex - 1)}
          onNext={() => {
            if (currentLegIndex >= legs.length - 1) {
              setIsFollowingUser(false);
              setIsFinished(true);
            } else goToLeg(currentLegIndex + 1);
          }}
          onExit={() => (router.canGoBack() ? router.back() : handleGoHome())}
          onLayout={(e: LayoutChangeEvent) => setPanelHeight(e.nativeEvent.layout.height)}
        />
      )}

      {isFinished && (
        <ArrivalCelebration
          routeData={stored.route}
          destinationLabel={stored.destinationName}
          onGoHome={handleGoHome}
        />
      )}
    </View>
  );
}
