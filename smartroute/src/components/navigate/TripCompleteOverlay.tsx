// src/components/navigate/TripCompleteOverlay.tsx
//
// Animasi "berhasil" saat perjalanan selesai, seperti konfirmasi pesanan:
// lingkaran hijau muncul memantul, tanda centang menyusul, cincin melebar,
// lalu layar memudar ke Ringkasan Perjalanan yang sudah siap di bawahnya.
// Ketuk untuk melewati. Dilewati otomatis kalau sistem meminta gerakan dikurangi.
import Text from "@/components/Text";
import { t } from "@/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";

const CIRCLE_SIZE = 112;
const CHECK_SIZE = 68;
const EMERALD = "#018959";
const SURFACE = "#F8FAFC"; // sama dengan latar Ringkasan, supaya peralihannya mulus

const CHECK_DELAY_MS = 180;
const RING_DELAY_MS = 150;
const RING_MS = 650;
const TEXT_DELAY_MS = 350;
const TEXT_MS = 280;
const HOLD_UNTIL_MS = 1500;
const FADE_OUT_MS = 280;

export default function TripCompleteOverlay({
  destinationName,
  onDone,
}: {
  destinationName: string;
  onDone: () => void;
}) {
  const circle = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (!cancelled) onDoneRef.current();
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          finish();
          return;
        }
        Animated.parallel([
          Animated.spring(circle, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(CHECK_DELAY_MS),
            Animated.spring(check, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
          ]),
          Animated.timing(ring, {
            toValue: 1,
            delay: RING_DELAY_MS,
            duration: RING_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(content, { toValue: 1, delay: TEXT_DELAY_MS, duration: TEXT_MS, useNativeDriver: true }),
        ]).start();
        timer = setTimeout(() => {
          Animated.timing(overlay, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start(finish);
        }, HOLD_UNTIL_MS);
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [check, circle, content, overlay, ring]);

  return (
    <Animated.View
      testID="trip-complete-overlay"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, opacity: overlay, backgroundColor: SURFACE }}
    >
      <Pressable
        onPress={() => onDoneRef.current()}
        accessibilityRole="button"
        accessibilityLabel={t("summary.complete")}
        className="flex-1 items-center justify-center px-8 gap-6"
      >
        <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, alignItems: "center", justifyContent: "center" }}>
          <Animated.View
            style={{
              position: "absolute",
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: CIRCLE_SIZE / 2,
              backgroundColor: EMERALD,
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
            }}
          />
          <Animated.View
            style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: CIRCLE_SIZE / 2,
              backgroundColor: EMERALD,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: circle }],
            }}
          >
            <Animated.View style={{ opacity: check.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: "clamp" }), transform: [{ scale: check }] }}>
              <Ionicons name="checkmark-sharp" size={CHECK_SIZE} color="#FFFFFF" />
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View
          accessibilityLiveRegion="polite"
          style={{
            alignItems: "center",
            gap: 6,
            opacity: content,
            transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}
        >
          <Text className="text-ink text-2xl text-center" weight="bold">
            {t("summary.complete")}
          </Text>
          <Text className="text-ink-2 text-[15px] text-center" numberOfLines={2}>
            {destinationName}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
