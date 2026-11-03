import type { Network } from "@/simulation/types";
import Modal from "./Modal";

const link = "underline underline-offset-2 hover:text-white";

function Ext({ href, children }: { href: string; children: string }) {
  return (
    <a className={link} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export default function AboutDialog({ network, onClose }: { network: Network; onClose: () => void }) {
  const { feeds, builtAt, osmExtract } = network.version;
  return (
    <Modal title="Tentang & Atribusi" onClose={onClose}>
      <div className="space-y-4 text-light-2 leading-relaxed">
        <section>
          <h3 className="font-bold text-light-1 mb-1">Ini simulasi</h3>
          <p>
            Semua posisi kendaraan dihitung dari jadwal, bukan data armada real-time. Dashboard ini tidak terhubung ke
            sistem operator mana pun, dan tidak menyiratkan kemitraan atau izin dari operator mana pun.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Kemacetan tidak dimodelkan. Waktu tempuh memakai kecepatan rata-rata tiap pola dari jadwal.</li>
            <li>Lama berhenti di halte adalah asumsi: 25 detik rel, 20 detik BRT, 15 detik bus.</li>
            <li>Jumlah kendaraan dibatasi paling banyak 14 per pola perjalanan.</li>
            <li>
              Banyak koridor BRT di data TransJakarta tertulis beroperasi 24 jam dengan selang yang sama, sehingga jumlah
              kendaraan malam hari di simulasi kemungkinan lebih tinggi dari keadaan sebenarnya.
            </li>
            <li>LRT Jakarta dan Whoosh belum ada di data jaringan ini.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-bold text-light-1 mb-1">Sumber data</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="text-light-1">Bus dan BRT:</span> © PT Transportasi Jakarta, GTFS, lisensi{" "}
              <Ext href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Ext>. Berkas {feeds.transjakarta}.
              Geometri disederhanakan untuk tampilan.
            </li>
            <li>
              <span className="text-light-1">Geometri rel:</span> ©{" "}
              <Ext href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</Ext>, lisensi{" "}
              <Ext href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</Ext>. Diturunkan dari ekstrak{" "}
              {osmExtract}. Data turunan ini tersedia di bawah ODbL:{" "}
              <a className={link} href={`${import.meta.env.BASE_URL}data/network.json`} download>
                unduh network.json
              </a>
              .
            </li>
            <li>
              <span className="text-light-1">Jadwal rel:</span> GTFS KRL, MRT, dan LRT Jabodebek yang disusun tim dari
              jadwal terbitan umum (berkas {feeds.krl}, {feeds.mrt}, {feeds.lrt}), bukan feed resmi operator. Koordinat
              stasiun dari OpenStreetMap.
            </li>
            <li>
              <span className="text-light-1">Peta dasar:</span> © CARTO, © OpenStreetMap contributors.
            </li>
          </ul>
          <p className="mt-2 text-xs">Data jaringan dibangun {builtAt}.</p>
        </section>

        {import.meta.env.VITE_GREENOPS_ENABLED === "true" && (
          <section>
            <h3 className="font-bold text-light-1 mb-1">Angka GreenOps</h3>
            <p>
              Semua angka energi dan emisi adalah estimasi dari jarak simulasi dikali faktor. Sumber, tahun, dan asumsi tiap
              faktor bisa dibuka dari ikon info di panel GreenOps. Moda tanpa sumber layak ditandai “tidak tersedia” dan
              tidak dihitung.
            </p>
          </section>
        )}
      </div>
    </Modal>
  );
}
