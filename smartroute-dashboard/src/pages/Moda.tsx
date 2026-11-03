import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Play } from "lucide-react";
import AboutDialog from "@/components/moda/AboutDialog";
import { StopCard, VehicleCard } from "@/components/moda/DetailCard";
import { clock, DAY_NAMES, fmt0, MODE_META, SIM_LABEL } from "@/components/moda/modaMeta";
import TransitMapLayers from "@/components/moda/TransitMapLayers";
import { Map, MapControls } from "@/components/ui/map";
import { useNetwork } from "@/hooks/useNetwork";
import { DAY_SEC } from "@/simulation/constants";
import { createSimulation, toWibTime } from "@/simulation/engine";
import type { ModeKey, Network, WibTime } from "@/simulation/types";

const TICK_MS = 500;
const SPEEDS = [1, 5, 15];
const JABODETABEK_BOUNDS: [[number, number], [number, number]] = [
  [106.0, -6.9],
  [107.5, -5.9],
];

function advance(t: WibTime, sec: number): WibTime {
  const next = t.secOfDay + sec;
  if (next < DAY_SEC) return { ...t, secOfDay: next };
  return { dayIndex: (t.dayIndex + 1) % 7, secOfDay: next - DAY_SEC };
}

function ModaView({ network }: { network: Network }) {
  const sim = useMemo(() => createSimulation(network.patterns), [network]);
  const [time, setTime] = useState<WibTime>(() => toWibTime(new Date()));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [enabled, setEnabled] = useState<Set<ModeKey>>(
    () => new Set(MODE_META.filter((m) => m.defaultOn).map((m) => m.key)),
  );
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [basemapFailed, setBasemapFailed] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTime((t) => advance(t, (TICK_MS / 1000) * speed)), TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  const vehicles = useMemo(() => sim.getSnapshot(time), [sim, time]);

  const counts = useMemo(() => {
    const out = {} as Record<ModeKey, number>;
    for (const m of MODE_META) out[m.key] = 0;
    for (const v of vehicles) out[v.mode]++;
    return out;
  }, [vehicles]);

  const lookups = useMemo(
    () => ({
      routes: new globalThis.Map(network.routes.map((r) => [r.id, r])),
      stops: new globalThis.Map(network.stops.map((s) => [s.id, s])),
      patterns: new globalThis.Map(network.patterns.map((p) => [p.id, p])),
    }),
    [network],
  );

  const stopName = useCallback(
    (id: string | null) => (id ? (lookups.stops.get(id)?.name ?? id) : "Halte terakhir"),
    [lookups],
  );
  const onBasemapFailed = useCallback(() => setBasemapFailed(true), []);

  const selected = vehicleId ? (vehicles.find((v) => v.id === vehicleId) ?? null) : null;
  // Pola tetap bisa dibaca dari id, sehingga kartu tetap tahu rutenya setelah trip selesai.
  const selectedPattern = vehicleId ? lookups.patterns.get(vehicleId.split("#")[0]) : undefined;
  const feedDate = Object.values(network.version.feeds).sort().at(-1);
  const shownCount = MODE_META.reduce((n, m) => n + (enabled.has(m.key) ? counts[m.key] : 0), 0);

  const toggleMode = (key: ModeKey) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const goNow = () => {
    setTime(toWibTime(new Date()));
    setSpeed(1);
    setPlaying(true);
  };

  return (
    <div className="dark min-h-dvh md:h-dvh flex flex-col bg-dark-1 text-light-1 overflow-x-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-light-1/10 px-3 py-2">
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-tight">Pemantauan Moda</h1>
          <p data-testid="sim-label" className="text-xs font-medium text-amber-200">
            {SIM_LABEL}
          </p>
          <p data-testid="data-version" className="text-[11px] text-light-2">
            Versi data {network.version.builtAt} · berkas jadwal {feedDate}
          </p>
        </div>
        <nav className="flex items-center gap-2 text-xs">
          <Link to="/" className="min-h-10 inline-flex items-center rounded-md border border-light-1/20 px-3 hover:bg-light-1/10">
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="min-h-10 rounded-md border border-light-1/20 px-3 hover:bg-light-1/10 cursor-pointer"
          >
            Tentang &amp; Atribusi
          </button>
        </nav>
      </header>

      <main className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[270px_minmax(0,1fr)]">
        <div className="relative order-1 md:order-2 h-[55dvh] md:h-auto min-h-0">
          <Map
            theme="dark"
            center={[106.83, -6.25]}
            zoom={9.8}
            minZoom={8.5}
            maxZoom={17}
            maxBounds={JABODETABEK_BOUNDS}
            attributionControl={{
              compact: true,
              customAttribution: "© OpenStreetMap contributors · © PT Transportasi Jakarta",
            }}
          >
            <MapControls position="top-right" />
            <TransitMapLayers
              network={network}
              vehicles={vehicles}
              enabled={enabled}
              selectedVehicleId={vehicleId}
              onSelectVehicle={setVehicleId}
              onSelectStop={setStopId}
              onBasemapFailed={onBasemapFailed}
            />
          </Map>
          {basemapFailed && (
            <p className="absolute left-2 top-2 z-10 rounded-md bg-dark-2/90 px-2 py-1 text-xs text-light-2">
              Peta dasar gagal dimuat. Jaringan tetap ditampilkan.
            </p>
          )}
          {vehicleId && (
            <VehicleCard
              vehicle={selected}
              route={selectedPattern ? lookups.routes.get(selectedPattern.routeId) : undefined}
              pattern={selectedPattern}
              stopName={stopName}
              onClose={() => setVehicleId(null)}
            />
          )}
          {stopId && lookups.stops.get(stopId) && (
            <StopCard stop={lookups.stops.get(stopId)!} network={network} onClose={() => setStopId(null)} />
          )}
        </div>

        <aside className="order-2 md:order-1 md:overflow-y-auto border-t md:border-t-0 md:border-r border-light-1/10 p-3 space-y-4 text-sm">
          <section aria-label="Kontrol waktu" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">Waktu simulasi</h2>
              <span data-testid="sim-clock" className="font-mono text-base tabular-nums">
                {clock(time.secOfDay)}
              </span>
            </div>
            <label className="block text-xs text-light-2">
              Hari jadwal
              <select
                value={time.dayIndex}
                onChange={(e) => setTime((t) => ({ ...t, dayIndex: Number(e.target.value) }))}
                className="mt-1 block w-full min-h-10 rounded-md border border-light-1/20 bg-dark-2 px-2 text-light-1"
              >
                {DAY_NAMES.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-light-2">
              Jam (00:00–24:00 WIB)
              <input
                type="range"
                min={0}
                max={DAY_SEC - 60}
                step={60}
                value={Math.floor(time.secOfDay / 60) * 60}
                onChange={(e) => setTime((t) => ({ ...t, secOfDay: Number(e.target.value) }))}
                className="mt-1 w-full accent-amber-300 cursor-pointer"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Jeda" : "Putar"}
                className="inline-flex size-10 items-center justify-center rounded-md border border-light-1/20 hover:bg-light-1/10 cursor-pointer"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={`min-h-10 min-w-10 rounded-md border px-2 text-xs cursor-pointer ${
                    speed === s ? "border-light-1 bg-light-1 text-dark-1 font-bold" : "border-light-1/20 hover:bg-light-1/10"
                  }`}
                >
                  {s}×
                </button>
              ))}
              <button
                type="button"
                onClick={goNow}
                className="min-h-10 rounded-md border border-light-1/20 px-3 text-xs hover:bg-light-1/10 cursor-pointer"
              >
                Sekarang
              </button>
            </div>
          </section>

          <section aria-label="Filter moda">
            <h2 className="font-bold mb-1">Moda di peta</h2>
            <p className="text-xs text-light-2 mb-1" data-testid="vehicle-count">
              {fmt0(shownCount)} kendaraan simulasi ditampilkan
            </p>
            <ul>
              {MODE_META.map((m) => (
                <li key={m.key}>
                  <label className="flex min-h-10 items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      data-mode={m.key}
                      checked={enabled.has(m.key)}
                      onChange={() => toggleMode(m.key)}
                      className="size-4 accent-amber-300"
                    />
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
                    <span className="flex-1 min-w-0">{m.label}</span>
                    <span data-testid={`count-${m.key}`} className="text-xs tabular-nums text-light-2">
                      {fmt0(counts[m.key])}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-xs text-light-2 mt-1">LRT Jakarta dan Whoosh belum ada di data jaringan.</p>
          </section>
        </aside>
      </main>

      {showAbout && <AboutDialog network={network} onClose={() => setShowAbout(false)} />}
    </div>
  );
}

export default function Moda() {
  const { network, error, retry } = useNetwork();

  if (error) {
    return (
      <div className="dark min-h-dvh flex flex-col items-center justify-center gap-3 bg-dark-1 p-6 text-center text-light-1">
        <p data-testid="load-error">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="min-h-10 rounded-md border border-light-1/30 px-4 text-sm hover:bg-light-1/10 cursor-pointer"
        >
          Coba lagi
        </button>
      </div>
    );
  }
  if (!network) {
    return (
      <div className="dark min-h-dvh flex flex-col items-center justify-center gap-1 bg-dark-1 p-6 text-center text-light-1">
        <p>Memuat data jaringan…</p>
        <p className="text-xs text-amber-200">{SIM_LABEL}</p>
      </div>
    );
  }
  return <ModaView network={network} />;
}
