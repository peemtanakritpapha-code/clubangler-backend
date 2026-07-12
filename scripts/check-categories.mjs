// scripts/check-categories.mjs — ตรวจสินค้าทุกตัวใน DB ว่าหมวดยังมีจริงในต้นไม้ปัจจุบันไหม (หา "หมวดกำพร้า")
// วิธีใช้: node scripts/check-categories.mjs  (รันจากโฟลเดอร์โปรเจกต์ — อ่าน key จาก .env.local เอง)
// รันเมื่อไหร่ก็ได้ โดยเฉพาะ "หลังแก้ lib/catalog.js ทุกครั้ง" (Iron Rule: rename/ลบหมวดต้อง migrate เสมอ)
import fs from "fs";

// ── โหลด CATEGORY_TREE จาก lib/catalog.js โดยตรง (แปลง ESM → รันใน Function) ──
const src = fs.readFileSync("lib/catalog.js", "utf8").replace(/^export /gm, "");
const { CATEGORY_TREE } = new Function(src + "\nreturn { CATEGORY_TREE };")();

// ── อ่าน env ──
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) { console.log("❌ ไม่พบ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY ใน .env.local"); process.exit(1); }

// ── path ถูกต้องไหม: เดินต้นไม้ทีละชั้น · เจอ array = ชั้นสุดท้ายต้องเป็นสมาชิก ──
function validPath(path) {
  let n = CATEGORY_TREE;
  for (let i = 0; i < path.length; i++) {
    const k = path[i];
    if (Array.isArray(n)) return n.includes(k) && i === path.length - 1;
    if (n && typeof n === "object") { if (!(k in n)) return false; n = n[k]; }
    else return false; // ลงลึกเกินใบ (null)
  }
  return true;
}

const resp = await fetch(`${URL_}/rest/v1/products?select=id,name,cat_main,cat_sub,status&order=id`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!resp.ok) { console.log("❌ ดึงข้อมูลไม่สำเร็จ HTTP", resp.status, (await resp.text()).slice(0, 200)); process.exit(1); }
const rows = await resp.json();

let bad = 0;
for (const r of rows) {
  const path = [r.cat_main, ...(r.cat_sub ? r.cat_sub.split(" › ") : [])].filter(Boolean);
  if (!path.length || !validPath(path)) {
    bad++;
    console.log(`⚠️  #${r.id} [${r.status}] ${String(r.name).slice(0, 40)} → หมวด: ${path.join(" › ") || "(ว่าง)"}`);
  }
}
console.log("─".repeat(50));
console.log(bad === 0
  ? `✅ สินค้า ${rows.length} ตัว หมวดถูกต้องทั้งหมด`
  : `พบหมวดกำพร้า/ผิด ${bad} จาก ${rows.length} ตัว — แก้ผ่านฟอร์มแก้ไขประกาศ หรือแจ้ง Claude ทำ SQL migrate`);
