import {
  CAR_SOURCE,
  DIESEL_G_PER_LITER,
  FACTORS,
  FACTORS_APPROVED,
  FACTORS_VERSION,
  GRID_G_PER_KWH,
  gramsPerVehicleKm,
  type FactorModeKey,
  type Source,
} from "@/greenops/greenopsFactors";
import Modal from "./Modal";
import { fmt0, fmt2 } from "./modaMeta";

function SourceItem({ s }: { s: Source }) {
  return (
    <li>
      <a className="underline underline-offset-2 hover:text-white" href={s.url} target="_blank" rel="noreferrer">
        {s.title}
      </a>
      <div className="text-xs">
        Tahun {s.year}. Diambil: {s.used}.{!s.openedFullText && " Hanya sebagian yang terbaca (TODO:verifikasi)."}
      </div>
    </li>
  );
}

export default function FactorInfoDialog({ mode, onClose }: { mode: FactorModeKey; onClose: () => void }) {
  const f = FACTORS[mode];
  const g = gramsPerVehicleKm(mode);
  return (
    <Modal title={`Sumber estimasi: ${f.label}`} onClose={onClose}>
      <div className="space-y-3 text-light-2 leading-relaxed">
        {f.status === "tidak_tersedia" ? (
          <p>
            <span className="text-light-1 font-bold">Faktor tidak tersedia.</span> {f.unavailableReason}
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>Energi</dt>
            <dd className="text-light-1">
              {fmt2(f.energy!.value)} {f.energy!.unit} ({f.energy!.carrier})
            </dd>
            <dt>Emisi</dt>
            <dd className="text-light-1">
              {fmt0(g!)} g CO₂/km = {fmt2(f.energy!.value)} ×{" "}
              {f.energy!.carrier === "listrik" ? `${fmt0(GRID_G_PER_KWH)} g/kWh` : `${fmt0(DIESEL_G_PER_LITER)} g/L`}
            </dd>
            <dt>Kekuatan</dt>
            <dd className="text-light-1">
              {f.strength}
              {f.todoVerify && " · TODO:verifikasi"}
            </dd>
            <dt>Tahun</dt>
            <dd className="text-light-1">{f.year}</dd>
            <dt>Cakupan</dt>
            <dd className="text-light-1">{f.scope}</dd>
          </dl>
        )}
        {f.status === "tersedia" && (
          <p>
            <span className="text-light-1 font-bold">Asumsi: </span>
            {f.assumptions}
          </p>
        )}
        {f.capacity && (
          <p>
            <span className="text-light-1 font-bold">Kapasitas skenario: </span>
            {fmt0(f.capacity.passengers)} penumpang, {f.capacity.basis}.
          </p>
        )}
        {(f.sources.length > 0 || f.capacity) && (
          <div>
            <h3 className="font-bold text-light-1 mb-1">Sumber</h3>
            <ul className="list-disc pl-5 space-y-2">
              {f.sources.map((s) => (
                <SourceItem key={s.url} s={s} />
              ))}
              {f.capacity && !f.sources.includes(f.capacity.source) && <SourceItem s={f.capacity.source} />}
            </ul>
          </div>
        )}
        <p className="text-xs">
          Pembanding mobil: {CAR_SOURCE} Versi tabel {FACTORS_VERSION}
          {FACTORS_APPROVED ? "." : ", draf menunggu persetujuan."}
        </p>
      </div>
    </Modal>
  );
}
