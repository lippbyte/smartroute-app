import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  carComparison,
  hourlyCsv,
  modeRows,
  perPassengerRange,
  type ModeRow,
} from "@/greenops/calculate";
import {
  FACTORS,
  FACTORS_APPROVED,
  OCCUPANCY_SCENARIOS,
  type FactorModeKey,
  type OccupancyScenario,
} from "@/greenops/greenopsFactors";
import type { Simulation } from "@/simulation/engine";
import type { Vehicle, WibTime } from "@/simulation/types";
import FactorInfoDialog from "./FactorInfoDialog";
import { DAY_NAMES, fmt0 } from "./modaMeta";

const SCENARIOS: OccupancyScenario[] = ["rendah", "sedang", "tinggi"];
const NA = "tidak tersedia";

function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sumber dan asumsi ${label}`}
      title="Sumber, tahun, dan asumsi"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-light-2 hover:bg-light-1/10 hover:text-light-1 cursor-pointer"
    >
      <Info className="size-4" />
    </button>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="min-w-0 rounded-md bg-dark-1/60 p-2">
      <div className="text-[11px] text-light-2">{label}</div>
      <div className="font-bold text-light-1 truncate">{value}</div>
      <div className="text-[11px] text-light-2">{unit}</div>
    </div>
  );
}

function energyText(r: ModeRow, which: "hour" | "today"): string {
  const e = r[which];
  if (e.energy === null) return NA;
  return `${fmt0(e.energy)} ${e.energyUnit === "L" ? "liter" : "kWh"}`;
}

interface Props {
  sim: Simulation;
  time: WibTime;
  vehicles: Vehicle[];
}

export default function GreenOpsPanel({ sim, time, vehicles }: Props) {
  const [scenario, setScenario] = useState<OccupancyScenario>("sedang");
  const [info, setInfo] = useState<FactorModeKey | null>(null);

  // Dihitung ulang tiap 10 detik waktu simulasi: angkanya dibulatkan, jadi
  // menghitung tiap tick hanya membuang tenaga.
  const key = Math.floor(time.secOfDay / 10);
  const { rows, totals } = useMemo(
    () => modeRows(sim, time, vehicles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, time.dayIndex, key],
  );

  const comparison = useMemo(() => {
    let transit = 0;
    let car = 0;
    for (const r of rows) {
      const c = carComparison(r.mode, r.vkmToday, scenario);
      if (c) {
        transit += c.transitKgCo2;
        car += c.carKgCo2;
      }
    }
    return { transit, car };
  }, [rows, scenario]);

  const downloadCsv = () => {
    const blob = new Blob([hourlyCsv(sim, time.dayIndex)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estimasi-greenops-per-jam-${DAY_NAMES[time.dayIndex].toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Panel GreenOps" className="space-y-4 text-sm" data-testid="greenops-panel">
      <div>
        <h2 className="font-bold text-base">GreenOps</h2>
        <p className="text-xs text-light-2">
          Estimasi dari jarak simulasi × faktor. Semua moda dihitung, tidak mengikuti filter peta.
        </p>
        {!FACTORS_APPROVED && (
          <p data-testid="draft-badge" className="mt-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs text-amber-200">
            Draf: tabel faktor menunggu persetujuan tim.
          </p>
        )}
      </div>

      <div>
        <h3 className="font-bold mb-1">Estimasi total armada</h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Emisi per jam" value={fmt0(totals.kgCo2LastHour)} unit="kg CO₂/jam" />
          <Stat label="Emisi sejak 00:00" value={fmt0(totals.kgCo2Today)} unit="kg CO₂" />
          <Stat label="Listrik per jam" value={fmt0(totals.kwhLastHour)} unit="kWh/jam" />
          <Stat label="Solar per jam" value={fmt0(totals.litersLastHour)} unit="liter/jam" />
          <Stat label="Listrik sejak 00:00" value={fmt0(totals.kwhToday)} unit="kWh" />
          <Stat label="Solar sejak 00:00" value={fmt0(totals.litersToday)} unit="liter" />
        </div>
        <p className="mt-1 text-xs text-light-2">
          Tidak termasuk {totals.excludedModes.join(" dan ")} ({fmt0(totals.excludedVehicles)} kendaraan aktif): faktor
          tidak tersedia.
        </p>
      </div>

      <div>
        <h3 className="font-bold mb-1">Estimasi per moda</h3>
        <ul className="divide-y divide-light-1/10">
          {rows.map((r) => (
            <li key={r.mode} data-testid={`mode-row-${r.mode}`} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium min-w-0">{r.label}</span>
                <span className="flex items-center gap-1 text-xs text-light-2 shrink-0">
                  {fmt0(r.activeVehicles)} aktif
                  <InfoButton label={r.label} onClick={() => setInfo(r.mode)} />
                </span>
              </div>
              {r.available ? (
                <dl className="grid grid-cols-[1fr_auto] gap-x-2 text-xs text-light-2">
                  <dt>Emisi per jam</dt>
                  <dd className="text-right text-light-1">{fmt0(r.hour.kgCo2!)} kg CO₂/jam</dd>
                  <dt>Energi per jam</dt>
                  <dd className="text-right text-light-1">{energyText(r, "hour")}/jam</dd>
                  <dt>Sejak 00:00</dt>
                  <dd className="text-right text-light-1">
                    {fmt0(r.today.kgCo2!)} kg CO₂, {energyText(r, "today")}
                  </dd>
                </dl>
              ) : (
                <p className="text-xs text-light-2">Energi dan emisi: {NA}</p>
              )}
            </li>
          ))}
          {(["lrt_jakarta", "whoosh"] as const).map((m) => (
            <li key={m} data-testid={`mode-row-${m}`} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{FACTORS[m].label}</span>
                <InfoButton label={FACTORS[m].label} onClick={() => setInfo(m)} />
              </div>
              <p className="text-xs text-light-2">Belum ada di data jaringan. Energi dan emisi: {NA}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-bold mb-1">Skenario okupansi</h3>
        <label className="block text-xs text-light-2" htmlFor="okupansi">
          Asumsi okupansi, bukan hitungan penumpang.
        </label>
        <input
          id="okupansi"
          type="range"
          min={0}
          max={2}
          step={1}
          value={SCENARIOS.indexOf(scenario)}
          onChange={(e) => setScenario(SCENARIOS[Number(e.target.value)])}
          aria-valuetext={`${scenario}, ${OCCUPANCY_SCENARIOS[scenario] * 100} persen kapasitas`}
          className="w-full mt-2 accent-amber-300 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-light-2">
          {SCENARIOS.map((s) => (
            <span key={s} className={s === scenario ? "text-light-1 font-bold" : undefined}>
              {s} {OCCUPANCY_SCENARIOS[s] * 100}%
            </span>
          ))}
        </div>
        <ul className="mt-2 space-y-1 text-xs">
          {rows.map((r) => {
            const range = perPassengerRange(r.mode, scenario);
            return (
              <li key={r.mode} className="flex justify-between gap-2" data-testid={`range-${r.mode}`}>
                <span className="text-light-2 min-w-0">{r.label}</span>
                <span className="text-right shrink-0">
                  {range ? (
                    <>
                      {fmt0(range.lowG)}–{fmt0(range.highG)} g/pkm;{" "}
                      <span className="font-bold">
                        {fmt0(range.selectedG)} g/pkm pada {fmt0(range.passengers)} orang
                      </span>
                    </>
                  ) : (
                    NA
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="font-bold mb-1">Perbandingan skenario: mobil pribadi</h3>
        <p className="text-xs text-light-2">
          Jika jumlah penumpang skenario {scenario} menempuh jarak yang sama sendiri-sendiri dengan mobil (170 g/pkm).
          Estimasi sejak 00:00, moda berfaktor saja.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="Angkutan umum" value={fmt0(comparison.transit)} unit="kg CO₂" />
          <Stat label="Mobil pribadi" value={fmt0(comparison.car)} unit="kg CO₂" />
        </div>
      </div>

      <button
        type="button"
        onClick={downloadCsv}
        className="w-full min-h-10 rounded-md border border-light-1/20 px-3 text-xs font-medium hover:bg-light-1/10 cursor-pointer"
      >
        Unduh CSV estimasi per moda per jam ({DAY_NAMES[time.dayIndex]})
      </button>

      {info && <FactorInfoDialog mode={info} onClose={() => setInfo(null)} />}
    </section>
  );
}
