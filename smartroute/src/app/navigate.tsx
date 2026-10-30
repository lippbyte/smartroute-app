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
import NavAlert, { type NavAlertContent } from "@/components/navigate/NavAlert";
import NavBanner from "@/components/navigate/NavBanner";
import NavigateMap, { NavigateMapHandle } from "@/components/navigate/NavigateMap";
import SimpleNavView from "@/components/navigate/SimpleNavView";
import { useAssistive } from "@/context/AssistiveSettingsContext";
import { plainStep } from "@/utils/simpleSteps";
import type { MapSegment, MapStop } from "@/components/navigate/navigateMapTypes";
import NavPanel from "@/components/navigate/NavPanel";
import TripSummary from "@/components/navigate/TripSummary";
import { legModeStyle } from "@/components/transit/legModes";
import Text from "@/components/Text";
import { getRoute } from "@/services/routeStore";
import { newClientRef } from "@/services/tripService";
import { haversineM, isWalkLeg, LatLng, legDurationMin } from "@/utils/navInstructions";
import { computeLegProgress, legPath, nearestVertex } from "@/utils/navProgress";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, LayoutChangeEvent, Pressable, Vibration, View } from "react-native";

// Hari 3 Task 2: peringatan teks besar tampil sekian lama lalu hilang sendiri.
const NAV_ALERT_MS = 7000;
// Pola getar (Android: jeda, getar, jeda, getar; iOS mengabaikan pola dan
// bergetar sekali). Izin VIBRATE ada di manifest (audit Hari 3 Task 0c).
const VIBRATE_PATTERN = [0, 400, 200, 400];

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

  // Hari 1 Task 5: dasar durasi "Aktual" di Ringkasan Perjalanan.
  // - Waktu mulai = saat layar navigasi dibuka.
  // - Durasi aktual HANYA diisi oleh trigger kedatangan 75 m di bawah, dan
  //   hanya bila GPS pernah tercatat di LUAR radius itu (pengguna benar-
  //   benar menempuh perjalanan — bukan membuka navigasi saat sudah di
  //   tujuan, yang akan menghasilkan "Aktual 0 mnt" palsu).
  // - Selesai lewat tombol manual = "Estimasi".
  // clientRef: satu per sesi navigasi, supaya simpan ulang tidak dobel.
  const startedAtRef = useRef(Date.now());
  const wasAwayFromDestinationRef = useRef(false);
  const [actualMinutes, setActualMinutes] = useState<number | null>(null);
  const clientRefRef = useRef(newClientRef());

  // Hari 3 Task 2: bantuan aksesibilitas (semua bawaan mati -> layar sama
  // persis seperti sebelumnya). bigAlerts: kejadian yang dipicu GPS (pindah
  // langkah, tiba) ditandai teks besar + getar, tanpa suara. simpleNav: satu
  // langkah per layar tanpa peta.
  const { settings: assistive } = useAssistive();
  const bigAlertsRef = useRef(assistive.bigAlerts.on);
  bigAlertsRef.current = assistive.bigAlerts.on;
  const [navAlert, setNavAlert] = useState<NavAlertContent | null>(null);
  const notify = (content: NavAlertContent) => {
    if (!bigAlertsRef.current) return;
    setNavAlert(content);
    try {
      Vibration.vibrate(VIBRATE_PATTERN);
    } catch {
      // Getar tidak tersedia (mis. web/izin): teks besar tetap tampil.
    }
    AccessibilityInfo.announceForAccessibility(`${content.title}. ${content.detail}`);
  };
  useEffect(() => {
    if (!navAlert) return;
    const t = setTimeout(() => setNavAlert(null), NAV_ALERT_MS);
    return () => clearTimeout(t);
  }, [navAlert]);

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

    const finalStop = legs[legs.length - 1]?.to_coord;
    if (
      finalStop &&
      haversineM(userLocation, { latitude: finalStop.lat, longitude: finalStop.lng }) > ARRIVAL_RADIUS_METERS
    ) {
      wasAwayFromDestinationRef.current = true;
    }

    if (isLast) {
      if (dist <= ARRIVAL_RADIUS_METERS && !hasAutoArrivedRef.current) {
        hasAutoArrivedRef.current = true;
        if (wasAwayFromDestinationRef.current) {
          setActualMinutes(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60_000)));
        }
        setIsFollowingUser(false);
        setIsFinished(true);
        notify({ kind: "arrived", title: "Anda sudah tiba", detail: stored?.destinationName ?? leg.to });
      }
      return;
    }
    const radius = isWalkLeg(leg) ? WALK_LEG_END_RADIUS_M : TRANSIT_LEG_END_RADIUS_M;
    if (dist <= radius) {
      const nextIndex = Math.min(currentLegIndex + 1, legs.length - 1);
      setCurrentLegIndex(nextIndex);
      const next = plainStep(legs[nextIndex], nextIndex === legs.length - 1);
      notify({ kind: "step", title: next.title, detail: next.detail });
    }
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
  // Hari 3: Mode sederhana menggantikan peta + banner + panel (deteksi GPS,
  // pindah langkah otomatis, dan trigger 75 m tetap berjalan di atas).
  const simple = assistive.simpleNav.on;
  const nextOrFinish = () => {
    if (currentLegIndex >= legs.length - 1) {
      setIsFollowingUser(false);
      setIsFinished(true);
    } else goToLeg(currentLegIndex + 1);
  };

  return (
    <View className="flex-1 bg-[#18181B]">
      {!simple && (
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
      )}

      {simple && !isFinished && (
        <SimpleNavView
          legs={legs}
          currentLegIndex={currentLegIndex}
          progress={progress}
          remainingMin={remainingMin}
          onPrev={() => goToLeg(currentLegIndex - 1)}
          onNext={nextOrFinish}
          onExit={() => (router.canGoBack() ? router.back() : handleGoHome())}
        />
      )}

      {!isFinished && !simple && (
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
      {!isFinished && !simple && (
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

      {!isFinished && !simple && (
        <NavPanel
          route={stored.route}
          currentLegIndex={currentLegIndex}
          currentLegFraction={progress.onRoute ? progress.fraction : 0}
          remainingMin={remainingMin}
          remainingM={remainingM}
          onSelectLeg={goToLeg}
          onPrev={() => goToLeg(currentLegIndex - 1)}
          onNext={nextOrFinish}
          onExit={() => (router.canGoBack() ? router.back() : handleGoHome())}
          onLayout={(e: LayoutChangeEvent) => setPanelHeight(e.nativeEvent.layout.height)}
        />
      )}

      {isFinished && (
        <TripSummary
          route={stored.route}
          originName={stored.originName}
          destinationName={stored.destinationName}
          actualMinutes={actualMinutes}
          clientRef={clientRefRef.current}
          onGoHome={handleGoHome}
        />
      )}

      {/* Hari 3: peringatan teks besar (hanya bila bantuan aktif). */}
      {navAlert && <NavAlert alert={navAlert} onDismiss={() => setNavAlert(null)} />}
    </View>
  );
}
