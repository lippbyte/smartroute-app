import { useState } from "react";
import { Info, X } from "lucide-react";
import { vehicleEstimate } from "@/greenops/calculate";
import { FACTORS, FACTORS_APPROVED } from "@/greenops/greenopsFactors";
import type { Network, NetworkRoute, NetworkStop, Pattern, Vehicle } from "@/simulation/types";
import FactorInfoDialog from "./FactorInfoDialog";
import { fmt0, fmt1, fmt2, MODE_META, SIM_LABEL } from "./modaMeta";

function Shell({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="absolute left-2 right-2 bottom-2 md:right-auto md:w-80 z-20 max-h-[70%] overflow-y-auto rounded-lg border border-light-1/15 bg-dark-2/95 p-3 text-sm text-light-1 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold min-w-0">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kartu"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-light-1/10 cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

const rowCls = "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-light-2";
const valCls = "text-right text-light-1";

interface VehicleProps {
  vehicle: Vehicle | null;
  route?: NetworkRoute;
  pattern?: Pattern;
  stopName: (id: string | null) => string;
  onClose: () => void;
}

export function VehicleCard({ vehicle, route, pattern, stopName, onClose }: VehicleProps) {
  const [showInfo, setShowInfo] = useState(false);
  if (!vehicle) {
    return (
      <Shell onClose={onClose} title="Kendaraan">
        <p className="text-xs text-light-2 mt-1">Trip ini sudah selesai pada waktu simulasi sekarang.</p>
      </Shell>
    );
  }
  const est = vehicleEstimate(vehicle);
  const factor = FACTORS[vehicle.mode];
  const meta = MODE_META.find((m) => m.key === vehicle.mode)!;
  return (
    <Shell onClose={onClose} title={`${route?.code ?? vehicle.routeId} · ${meta.label}`}>
      <p className="text-xs text-light-2">{route?.name}</p>
      <p className="text-[11px] text-amber-200 mt-1">{SIM_LABEL}</p>
      <dl className={`${rowCls} mt-2`} data-testid="vehicle-card">
        <dt>Arah</dt>
        <dd className={valCls}>{pattern?.headsign || "—"}</dd>
        <dt>Halte berikut</dt>
        <dd className={valCls}>{stopName(vehicle.nextStopId)}</dd>
        <dt>Status</dt>
        <dd className={valCls}>{vehicle.status}</dd>
        <dt>Kemajuan trip</dt>
        <dd className={valCls}>{fmt0(vehicle.progress * 100)}%</dd>
      </dl>
      <div className="mt-3 border-t border-light-1/10 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold">
            Estimasi GreenOps{!FACTORS_APPROVED && <span className="font-normal text-amber-200"> · draf</span>}
          </h4>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label={`Sumber dan asumsi ${factor.label}`}
            className="inline-flex size-8 items-center justify-center rounded-md text-light-2 hover:bg-light-1/10 cursor-pointer"
          >
            <Info className="size-4" />
          </button>
        </div>
        <dl className={rowCls} data-testid="vehicle-greenops">
          <dt>Jarak trip sejauh ini</dt>
          <dd className={valCls}>{fmt2(est.distanceKm)} km</dd>
          {est.gPerKm === null ? (
            <>
              <dt>Energi dan emisi</dt>
              <dd className={valCls}>tidak tersedia</dd>
            </>
          ) : (
            <>
              <dt>Energi per km</dt>
              <dd className={valCls}>
                {fmt2(est.energyPerKm!.value)} {est.energyPerKm!.unit}
              </dd>
              <dt>Emisi per km</dt>
              <dd className={valCls}>{fmt0(est.gPerKm)} g CO₂/km</dd>
              <dt>Emisi trip sejauh ini</dt>
              <dd className={valCls}>{fmt1(est.tripKgCo2!)} kg CO₂</dd>
            </>
          )}
        </dl>
      </div>
      {showInfo && <FactorInfoDialog mode={vehicle.mode} onClose={() => setShowInfo(false)} />}
    </Shell>
  );
}

interface StopProps {
  stop: NetworkStop;
  network: Network;
  onClose: () => void;
}

export function StopCard({ stop, network, onClose }: StopProps) {
  const routeIds = new Set(network.patterns.filter((p) => p.stopIds.includes(stop.id)).map((p) => p.routeId));
  const routes = network.routes.filter((r) => routeIds.has(r.id));
  return (
    <Shell onClose={onClose} title={stop.name}>
      <p className="text-xs text-light-2 mt-1">{routes.length} rute melintas menurut jadwal:</p>
      <ul className="mt-2 space-y-1 text-xs" data-testid="stop-card">
        {routes.map((r) => (
          <li key={r.id} className="flex gap-2">
            <span className="font-bold shrink-0">{r.code}</span>
            <span className="text-light-2 min-w-0">{r.name}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
