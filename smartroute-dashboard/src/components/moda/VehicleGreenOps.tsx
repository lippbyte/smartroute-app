import { useState } from "react";
import { Info } from "lucide-react";
import { vehicleEstimate } from "@/greenops/calculate";
import { FACTORS, FACTORS_APPROVED } from "@/greenops/greenopsFactors";
import type { Vehicle } from "@/simulation/types";
import FactorInfoDialog from "./FactorInfoDialog";
import { fmt0, fmt1, fmt2 } from "./modaMeta";

const rowCls = "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-light-2";
const valCls = "text-right text-light-1";

/** Bagian GreenOps pada kartu kendaraan. Hanya dimuat bila flag GreenOps menyala. */
export default function VehicleGreenOps({ vehicle }: { vehicle: Vehicle }) {
  const [showInfo, setShowInfo] = useState(false);
  const est = vehicleEstimate(vehicle);
  const factor = FACTORS[vehicle.mode];
  return (
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
      {showInfo && <FactorInfoDialog mode={vehicle.mode} onClose={() => setShowInfo(false)} />}
    </div>
  );
}
