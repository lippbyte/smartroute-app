// Hari 3 Task 4: uji form masukan dengan KODE ASLI app (feedbackService).
//
//   fase "offline": API_BASE_URL ke port mati -> kirim gagal jaringan
//                   (ApiError isNetwork) -> draf disimpan di perangkat.
//   fase "online" : proses BARU (= app dibuka ulang) memulihkan draf, kirim
//                   ke backend hidup -> 201; kirim ulang client_ref sama ->
//                   200 id sama (tidak dobel); tamu tidak butuh token.
// Jalankan dari smartroute/ dengan ASYNC_STORAGE_FILE yang sama di kedua fase.
import { ApiError } from "../src/services/apiClient";
import {
  clearFeedbackDraft,
  FEEDBACK_MAX,
  loadFeedbackDraft,
  newFeedbackRef,
  saveFeedbackDraft,
  sendFeedback,
} from "../src/services/feedbackService";

const PHASE = process.argv[2] ?? "offline";
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

if (PHASE === "offline") {
  await clearFeedbackDraft();
  const draft = { category: "rute_tidak_tepat" as const, message: `[uji draf ${Date.now()}] rute sore lebih lambat`, client_ref: newFeedbackRef() };
  await saveFeedbackDraft(draft); // layar menyimpan draf sebelum mengirim
  let err: unknown = null;
  try {
    await sendFeedback(null, { ...draft, app_version: "1.0.0" });
  } catch (e) {
    err = e;
  }
  check("D1 backend tidak terjangkau -> ApiError jaringan (bukan crash/hang)", err instanceof ApiError && err.isNetwork, err instanceof ApiError ? `${err.code}: ${err.message}` : String(err));
  const kept = await loadFeedbackDraft();
  check("D2 draf tetap tersimpan setelah gagal", kept?.message === draft.message && kept?.client_ref === draft.client_ref);
} else {
  const draft = await loadFeedbackDraft();
  check("D3 app dibuka ulang (proses baru): draf dipulihkan", !!draft?.message && draft.category === "rute_tidak_tepat", draft?.message);
  const first = await sendFeedback(null, { category: draft!.category!, message: draft!.message, client_ref: draft!.client_ref, app_version: "1.0.0" });
  await clearFeedbackDraft();
  check("D4 kirim ulang draf sebagai tamu (tanpa token) -> tersimpan, tidak tertaut akun", !!first.id && first.linked_to_account === false, first.id);
  const again = await sendFeedback(null, { category: draft!.category!, message: draft!.message, client_ref: draft!.client_ref });
  check("D5 kirim ulang client_ref sama -> id sama (tidak dobel)", again.id === first.id);
  check("D6 draf dihapus setelah terkirim", (await loadFeedbackDraft()) === null);
  let tooLong: unknown = null;
  try {
    await sendFeedback(null, { category: "lainnya", message: "x".repeat(FEEDBACK_MAX + 1), client_ref: newFeedbackRef() });
  } catch (e) {
    tooLong = e;
  }
  check("D7 pesan > 500 karakter ditolak server dengan pesan field", tooLong instanceof ApiError && tooLong.status === 400 && !!tooLong.fields.message, tooLong instanceof ApiError ? tooLong.fields.message : "");
}

console.log(failures === 0 ? `\nSemua uji draf masukan fase '${PHASE}' lulus.` : `\n${failures} uji GAGAL di fase '${PHASE}'.`);
process.exitCode = failures ? 1 : 0;
