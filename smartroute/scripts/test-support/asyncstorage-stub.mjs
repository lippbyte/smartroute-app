// Stub "@react-native-async-storage/async-storage" untuk uji di Node.
// Bila ASYNC_STORAGE_FILE di-set, data disimpan ke berkas JSON itu — dua
// proses Node berbeda (mis. fase "tulis" lalu "buka ulang") berbagi data,
// meniru app yang ditutup lalu dibuka lagi. Tanpa variabel itu: memori saja.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = process.env.ASYNC_STORAGE_FILE;
let mem = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const flush = () => file && writeFileSync(file, JSON.stringify(mem));

const AsyncStorage = {
  async getItem(k) {
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
  },
  async setItem(k, v) {
    mem[k] = String(v);
    flush();
  },
  async removeItem(k) {
    delete mem[k];
    flush();
  },
  async clear() {
    mem = {};
    flush();
  },
};
export default AsyncStorage;
