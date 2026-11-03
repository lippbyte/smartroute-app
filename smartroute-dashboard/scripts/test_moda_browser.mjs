// Uji /moda di Chrome headless lewat CDP. Tanpa dependensi.
// Pakai: npx vite build && npx vite preview --port 5199 --strictPort --host 127.0.0.1
//        node scripts/test_moda_browser.mjs <folder hasil> [url dasar]
// Bawaan menguji build dengan GreenOps MATI. Untuk build dengan
// VITE_GREENOPS_ENABLED=true, jalankan dengan MODA_GREENOPS=true.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'moda-browser-hasil';
const BASE = process.argv[3] ?? 'http://127.0.0.1:5199';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const GREENOPS = process.env.MODA_GREENOPS === 'true';
console.log(`Mode: GreenOps ${GREENOPS ? 'MENYALA' : 'MATI (bawaan)'}`);
mkdirSync(OUT, { recursive: true });
const profile = join(OUT, 'profil');
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') logs.push(`LOG ${d.params.entry.text} ${d.params.entry.url ?? ''}`);
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) logs.push(`${d.params.type} ` + d.params.args.map((a) => a.value ?? a.description).join(' '));
};
const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
};
const shot = async (name) => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
};
const viewport = (w, h, mobile = false) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
const waitFor = async (expr, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(200); } return false; };
const text = (tid) => ev(`document.querySelector('[data-testid="${tid}"]')?.innerText ?? null`);
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok, extra }); console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${extra ? '  [' + extra + ']' : ''}`); };
const clickBtn = (t) => ev(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(t)})?.click()`);
const fps = (sec) => ev(`new Promise(res=>{let n=0,long=0;const t0=performance.now();const po=new PerformanceObserver(l=>{long+=l.getEntries().length});try{po.observe({entryTypes:['longtask']})}catch{};const f=()=>{n++;if(performance.now()-t0<${sec*1000})requestAnimationFrame(f);else{po.disconnect();res({fps:+(n/${sec}).toFixed(1),longTasks:long})}};requestAnimationFrame(f)})`);

for (const d of ['Runtime', 'Log', 'Page', 'Network']) await cdp(`${d}.enable`);

// ---- Keadaan galat ----
await viewport(1440, 900);
await cdp('Network.setBlockedURLs', { urls: ['*network.json*'] });
await cdp('Page.navigate', { url: BASE + '/moda' });
check('galat: pesan Indonesia tampil saat data diblokir', await waitFor(`!!document.querySelector('[data-testid="load-error"]')`, 15000), await text('load-error'));
await shot('galat');
await cdp('Network.setBlockedURLs', { urls: [] });
await clickBtn('Coba lagi');
check('galat: tombol coba lagi memulihkan halaman', await waitFor(`!!document.querySelector('[data-testid="sim-label"]')`, 20000));
logs.length = 0;

// ---- Desktop ----
await cdp('Page.navigate', { url: BASE + '/moda' });
await waitFor(`!!document.querySelector('[data-testid="sim-label"]')`);
await waitFor(`!!document.querySelector('canvas.maplibregl-canvas')`);
await sleep(9000);
check('label simulasi tampil', (await text('sim-label')) === 'Posisi berdasarkan jadwal (simulasi)', await text('sim-label'));
check('versi data tampil', /Versi data \d{4}-\d{2}-\d{2}/.test(await text('data-version')), await text('data-version'));
await shot('desktop-awal');

// Kontrol waktu: jeda, set Senin 07:30
await ev(`(()=>{const s=document.querySelector('select');const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,'0');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const setRange = (sel, v) => ev(`(()=>{const s=document.querySelector(${JSON.stringify(sel)});const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(s,'${v}');s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await setRange('input[type=range]:not(#okupansi)', 27000);
await sleep(800);
const c1 = await text('sim-clock'); await sleep(1600); const c2 = await text('sim-clock');
check('jam simulasi berjalan', c1 !== c2, `${c1} -> ${c2}`);
await ev(`document.querySelector('button[aria-label="Jeda"]').click()`);
await sleep(700);
const c3 = await text('sim-clock'); await sleep(1300); const c4 = await text('sim-clock');
check('jeda menghentikan jam', c3 === c4, `${c3} = ${c4}`);
await ev(`document.querySelector('button[aria-label="Putar"]').click()`);
await clickBtn('15×'); await sleep(200);
const c5 = await text('sim-clock'); await sleep(2000); const c6 = await text('sim-clock');
const toS = (t) => t.split(':').reduce((a, b) => a * 60 + +b, 0);
check('kecepatan 15× memajukan waktu sekitar 30 dtk per 2 dtk', Math.abs(toS(c6) - toS(c5) - 30) <= 10, `${toS(c6) - toS(c5)} dtk`);
await clickBtn('1×');
await ev(`document.querySelector('button[aria-label="Jeda"]').click()`);

// Filter
const countOf = async () => parseInt((await text('vehicle-count')).replace(/\D/g, ''), 10);
const base = await countOf();
const busN = parseInt((await text('count-bus')).replace(/\D/g, ''), 10);
await ev(`document.querySelector('input[data-mode="bus"]').click()`); await sleep(500);
const withBus = await countOf();
check('filter: menyalakan bus menambah jumlah sesuai', withBus === base + busN, `${base} + ${busN} = ${withBus}`);
await sleep(1500);
const f1 = await fps(5);
await shot('desktop-bus-nyala');
await ev(`document.querySelector('input[data-mode="mikrotrans"]').click()`); await sleep(2000);
const all = await countOf();
await ev(`document.querySelector('button[aria-label="Putar"]').click()`); await sleep(500);
const fAll = await fps(6);
await ev(`document.querySelector('button[aria-label="Jeda"]').click()`);
for (const m of ['bus', 'mikrotrans', 'krl']) await ev(`document.querySelector('input[data-mode="${m}"]').click()`);
await sleep(500);
check('filter: mematikan KRL mengurangi jumlah', (await countOf()) < base, `${await countOf()} < ${base}`);
await ev(`document.querySelector('input[data-mode="krl"]').click()`); await sleep(300);
await ev(`document.querySelector('button[aria-label="Putar"]').click()`); await sleep(500);
const fDef = await fps(6);
await ev(`document.querySelector('button[aria-label="Jeda"]').click()`);
console.log('KINERJA (Chrome headless, WebGL perangkat lunak):', JSON.stringify({ bawaan: { n: base, ...fDef }, tambahBus: { n: withBus, ...f1, catatan: 'dijeda' }, semua: { n: all, ...fAll } }));

// GreenOps panel
let panel = '';
if (GREENOPS) {
panel = await ev(`document.querySelector('[data-testid="greenops-panel"]').innerText`);
check('panel: kata Estimasi ada', /Estimasi/.test(panel));
check('panel: tanpa kata terukur/real-time', !/terukur|real-?time/i.test(panel));
check('panel: Mikrotrans "tidak tersedia"', /tidak tersedia/.test(await text('mode-row-mikrotrans')), (await text('mode-row-mikrotrans')).replace(/\n/g, ' '));
check('panel: LRT Jabodebek "tidak tersedia"', /tidak tersedia/.test(await text('mode-row-lrt_jabodebek')));
check('panel: Whoosh & LRT Jakarta tampil', /tidak tersedia/.test(await text('mode-row-whoosh')) && /tidak tersedia/.test(await text('mode-row-lrt_jakarta')));
check('panel: penanda draf tampil', /Draf/.test(await text('draft-badge')));
check('panel: keterangan okupansi', /Asumsi okupansi, bukan hitungan penumpang/.test(panel));
check('panel: perbandingan berlabel skenario', /Perbandingan skenario/.test(panel));
const r1 = await text('range-brt');
await setRange('#okupansi', 2); await sleep(300);
const r2 = await text('range-brt');
check('slider okupansi mengubah nilai', r1 !== r2, `${r1.replace(/\n/g, ' ')} -> ${r2.replace(/\n/g, ' ')}`);
await setRange('#okupansi', 1);
await ev(`document.querySelector('[data-testid="mode-row-brt"] button').click()`); await sleep(300);
const dlg = await ev(`document.querySelector('[role=dialog]')?.innerText ?? ''`);
check('info faktor: sumber, tahun, asumsi', /ICCT/.test(dlg) && /Tahun/.test(dlg) && /Asumsi/.test(dlg), dlg.slice(0, 90).replace(/\n/g, ' '));
await shot('info-faktor');
await clickBtn('Tutup');

} else {
  const page = await ev(`document.body.innerText`);
  check('flag mati: panel GreenOps tidak ada', !(await ev(`!!document.querySelector('[data-testid="greenops-panel"]')`)));
  check('flag mati: halaman tanpa angka energi dan emisi', !/GreenOps|CO₂|kWh|liter|g\/pkm|Estimasi|Draf/.test(page));
  check('flag mati: peta memakai lebar panel kanan', await ev(`document.querySelector('canvas.maplibregl-canvas').getBoundingClientRect().right >= innerWidth - 2`));
}

// Klik kendaraan: pindai peta sampai kartu muncul
const rect = await ev(`(()=>{const r=document.querySelector('canvas.maplibregl-canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); };
let found = false;
scan: for (let fy = 0.3; fy < 0.8; fy += 0.04) for (let fx = 0.3; fx < 0.8; fx += 0.04) {
  await click(rect.x + rect.w * fx, rect.y + rect.h * fy);
  await sleep(60);
  if (await ev(`!!document.querySelector('[data-testid="vehicle-card"]')`)) { found = true; break scan; }
}
check('klik kendaraan membuka kartu', found);
if (found) {
  const card = await text('vehicle-card');
  // Bagian GreenOps dimuat lambat, jadi muncul sesaat setelah kartu.
  if (GREENOPS) await waitFor(`!!document.querySelector('[data-testid="vehicle-greenops"]')`, 8000);
  const gre = GREENOPS ? await text('vehicle-greenops') : null;
  console.log('kartu:', card.replace(/\n/g, ' | '));
  if (GREENOPS) console.log('estimasi:', gre.replace(/\n/g, ' | '));
  else check('flag mati: kartu kendaraan tanpa GreenOps', !(await ev(`/GreenOps|CO₂|kWh|L\\/km/.test(document.body.innerText)`)));
  check('kartu memuat arah, halte berikut, status', /Arah/.test(card) && /Halte berikut/.test(card) && /Status/.test(card));
  if (GREENOPS) {
  const num = (t) => parseFloat(t.replace(/\./g, '').replace(',', '.'));
  const km = num(/sejauh ini\s+([\d.,]+) km/.exec(gre)?.[1] ?? '');
  const gkm = num(/Emisi per km\s+([\d.,]+) g/.exec(gre)?.[1] ?? '');
  const kg = num(/Emisi trip sejauh ini\s+([\d.,]+) kg/.exec(gre)?.[1] ?? '');
  check('angka di kartu: jarak × faktor = emisi trip', Math.abs((km * gkm) / 1000 - kg) <= 0.06, `${km} km × ${gkm} g = ${((km * gkm) / 1000).toFixed(2)} kg, tampil ${kg} kg`);
  }
  await shot('kartu-kendaraan');
  await ev(`document.querySelector('button[aria-label="Tutup kartu"]')?.click()`);
}

// Tentang
await clickBtn('Tentang & Atribusi'); await sleep(300);
const about = await ev(`document.querySelector('[role=dialog]').innerText`);
for (const needle of ['© PT Transportasi Jakarta', 'CC BY 4.0', 'OpenStreetMap contributors', 'ODbL 1.0', 'bukan data armada real-time']) check(`atribusi: ${needle}`, about.includes(needle));
check('tidak menyebut Simpul', !/simpul/i.test(about + panel));
if (!GREENOPS) check('flag mati: Tentang tanpa bagian GreenOps', !/GreenOps/.test(about));
const hrefs = await ev(`[...document.querySelectorAll('[role=dialog] a')].map(a=>a.href)`);
console.log('tautan:', hrefs.join(' '));
await shot('tentang');
await clickBtn('Tutup');

// ---- Peta dasar gagal ----
await cdp('Network.setBlockedURLs', { urls: ['*basemaps.cartocdn.com*'] });
await cdp('Page.navigate', { url: BASE + '/moda' });
await waitFor(`!!document.querySelector('[data-testid="sim-label"]')`);
const fellBack = await waitFor(`document.body.innerText.includes('Peta dasar gagal dimuat')`, 15000);
check('peta dasar gagal: pesan tampil, halaman tidak kosong', fellBack);
await sleep(3000);
await shot('peta-dasar-gagal');
await cdp('Network.setBlockedURLs', { urls: [] });
logs.length = 0;

// ---- 360 px ----
await viewport(360, 740, true);
await cdp('Page.navigate', { url: BASE + '/moda' });
await waitFor(`!!document.querySelector('[data-testid="sim-label"]')`);
await sleep(7000);
const ov = await ev(`({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bad:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>361||r.left<-1)&&!e.closest('.maplibregl-map')}).slice(0,5).map(e=>e.tagName+'.'+String(e.className).slice(0,50))})`);
check('360 px: tanpa gulir mendatar', ov.sw <= 360, JSON.stringify(ov));
check('360 px: label simulasi terlihat di layar', await ev(`(()=>{const r=document.querySelector('[data-testid="sim-label"]').getBoundingClientRect();return r.top>=0&&r.bottom<=740&&r.width>0})()`));
await shot('hp-atas');
await ev(`window.scrollTo(0, 500)`); await sleep(300); await shot('hp-tengah');
if (GREENOPS) { await ev(`document.querySelector('[data-testid="greenops-panel"]').scrollIntoView()`); await sleep(300); await shot('hp-greenops'); }
await ev(`window.scrollTo(0, 0)`);

const errs = [...new Set(logs)];

// ---- Halaman lama tetap jalan setelah FlagProvider dipindah ----
await viewport(1440, 900);
logs.length = 0;
await cdp('Page.navigate', { url: BASE + '/' });
await waitFor(`location.pathname === '/login'`, 8000);
check('tanpa token: / dialihkan ke /login', (await ev('location.pathname')) === '/login');
await ev(`localStorage.setItem('token', 'uji-lokal')`);
for (const path of ['/', '/map']) {
  await cdp('Page.navigate', { url: BASE + path });
  await sleep(2500);
  const body = await ev(`document.getElementById('root').innerText.length`);
  const crash = logs.filter((l) => /must be used within/.test(l));
  check(`halaman lama ${path} tampil tanpa galat provider`, body > 20 && crash.length === 0, `teks ${body}, galat ${crash.length}`);
}
for (const path of ['/', '/map']) {
  await cdp('Page.navigate', { url: BASE + path });
  await sleep(1800);
  const link = await ev(`({btn:[...document.querySelectorAll('button,a')].filter(e=>/moda/i.test(e.innerText)).map(e=>e.innerText),href:[...document.querySelectorAll('a')].filter(a=>/moda/i.test(a.getAttribute('href')||'')).length})`);
  check(`navigasi ${path}: tidak ada tautan atau tombol ke /moda`, link.btn.length === 0 && link.href === 0, JSON.stringify(link));
}
await cdp('Page.navigate', { url: BASE + '/moda' });
check('/moda tetap bisa dibuka lewat URL langsung', await waitFor(`!!document.querySelector('[data-testid="sim-label"]')`, 10000));
await ev(`localStorage.removeItem('token')`);
console.log('galat konsol:', errs.length, errs.slice(0, 12).map((e) => e.slice(0, 220)).join('\n  '));
writeFileSync(join(OUT, 'hasil.json'), JSON.stringify({ results, errs }, null, 1));
console.log(`\nRINGKAS: ${results.filter((r) => r.ok).length}/${results.length} lulus`);
ws.close(); chrome.kill();
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
