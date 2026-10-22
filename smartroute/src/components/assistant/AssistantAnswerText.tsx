// src/components/assistant/AssistantAnswerText.tsx
//
// Task App-22: jawaban dari /assistant/ask (LLM lewat OpenRouter) kadang
// mengandung markdown ringan (**bold**, list "- ...") — dikonfirmasi
// langsung lewat tes curl ke endpoint asli sebelum menulis komponen ini,
// bukan asumsi. Tidak ada library markdown di project ini, dan menambah
// satu cuma untuk ini terasa berlebihan untuk kebutuhan sekecil ini —
// parser ringan manual berikut cukup untuk 2 pola yang benar-benar
// muncul (bold & bullet list), konsisten dengan gaya proyek ini yang
// menghindari dependency baru kalau formatter manual sudah cukup (lihat
// utils/currency.ts, utils/departureTime.ts).
import Text from "@/components/Text";
import { View } from "react-native";

interface BoldSpan {
  text: string;
  bold: boolean;
}

function parseBoldSpans(line: string): BoldSpan[] {
  const spans: BoldSpan[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: line.slice(lastIndex, match.index), bold: false });
    }
    spans.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    spans.push({ text: line.slice(lastIndex), bold: false });
  }
  return spans;
}

// Ditemukan dari laporan user langsung (screenshot): jawaban LLM juga
// kadang pakai heading markdown ("# Judul", "## Sub-judul") — sebelumnya
// tanda pagar-nya ikut tampil mentah, bukan jadi heading berjenjang.
type LineKind = "h1" | "h2" | "h3" | "bullet" | "text";

function getLineKind(trimmed: string): LineKind {
  if (/^#{1,2}\s+/.test(trimmed)) return trimmed.startsWith("## ") ? "h2" : "h1";
  if (/^#{3,6}\s+/.test(trimmed)) return "h3";
  if (/^[-*]\s+/.test(trimmed)) return "bullet";
  return "text";
}

const HEADING_STYLE: Record<"h1" | "h2" | "h3", { className: string; marginTop: number }> = {
  h1: { className: "text-ink font-bold text-base", marginTop: 4 },
  h2: { className: "text-ink font-bold text-sm", marginTop: 4 },
  h3: { className: "text-ink font-bold text-sm", marginTop: 2 },
};

export default function AssistantAnswerText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <View className="gap-1">
      {lines.map((rawLine, index) => {
        if (rawLine.trim() === "") {
          // Baris kosong dari LLM (biasa dipakai sebagai pemisah paragraf)
          // -> jarak vertikal, bukan baris teks kosong yang ganjil.
          return <View key={index} style={{ height: 10 }} />;
        }

        const trimmed = rawLine.trim();
        const kind = getLineKind(trimmed);

        if (kind === "h1" || kind === "h2" || kind === "h3") {
          const content = trimmed.replace(/^#{1,6}\s+/, "");
          const spans = parseBoldSpans(content);
          const style = HEADING_STYLE[kind];
          return (
            <Text
              key={index}
              className={style.className}
              style={{ marginTop: style.marginTop }}
            >
              {spans.map((span, spanIndex) =>
                span.bold ? (
                  <Text key={spanIndex} className="font-bold text-ink">
                    {span.text}
                  </Text>
                ) : (
                  span.text
                ),
              )}
            </Text>
          );
        }

        const isBullet = kind === "bullet";
        const content = isBullet ? trimmed.replace(/^[-*]\s+/, "") : rawLine;
        const spans = parseBoldSpans(content);

        return (
          <View
            key={index}
            className={isBullet ? "flex-row gap-2 pl-1" : undefined}
          >
            {isBullet && <Text className="text-ink-2 text-sm">•</Text>}
            <Text
              className="text-ink text-sm flex-1"
              style={{ lineHeight: 21 }}
            >
              {spans.map((span, spanIndex) =>
                span.bold ? (
                  <Text key={spanIndex} className="font-bold text-ink">
                    {span.text}
                  </Text>
                ) : (
                  span.text
                ),
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
