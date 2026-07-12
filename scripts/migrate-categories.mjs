// scripts/migrate-categories.mjs — พาสินค้าเก่าจากหมวดเดิม → ต้นไม้ใหม่ (CAT-FINAL)
// วิธีใช้:  node scripts/migrate-categories.mjs          ← dry-run: โชว์แผน ไม่แตะ DB
//          node scripts/migrate-categories.mjs --apply  ← เขียนจริง
// กติกา: (1) map ชื่อเก่า→ใหม่ตามตาราง (2) เทียบชื่อตรงบนต้นใหม่ (3) resolve ไม่ได้ = ตัดเหลือ prefix ที่ valid (อย่างแย่เหลือหมวดหลัก ไม่มีทางกำพร้า)
import fs from "fs";

const src = fs.readFileSync("lib/catalog.js", "utf8").replace(/^export /gm, "");
const { CATEGORY_TREE } = new Function(src + "\nreturn { CATEGORY_TREE };")();

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) { console.log("ไม่พบ env"); process.exit(1); }
const APPLY = process.argv.includes("--apply");

// ── ตาราง map ชื่อเก่า → ชื่อ/เส้นทางใหม่ (ราย segment · ครอบชื่อเดิมทั้งต้น) ──
const MAIN_MAP = {
  "เหยื่อจริง": "เหยื่อหมัก & หัวเชื้อ",
  "เรือ & คายัค": "อุปกรณ์เรือ",
  "ชุดคอมโบ & อื่นๆ": "อื่นๆ / ไม่เข้าหมวด",
};
const SEG_MAP = {
  // คัน
  "คันเบท (Low Profile / Round)": "คันเบท", "คันโอเวอร์เฮด": "คันเบท",
  "ไลท์เกม": "ไลท์เกม / ตีเหยื่อจิ๋ว", "แอจจิ้ง": "อาจิ", "เมบาริง": "อาจิ", "ไมโครเกม": "ไมโครเกม / UL",
  "ตกหมึก (Eging)": "คันตกหมึก", "ชายฝั่ง / ชอร์จิ๊ก": "แคสติ้ง", "ป็อปปิ้ง": "แคสติ้ง",
  "ตีเหยื่อทั่วไป": "คันตีเหยื่อปลอม", "ตีเหยื่อปลอม": "คันตีเหยื่อปลอม",
  "ทูน่า / เกมใหญ่": "คันเกมใหญ่ / สแตนด์อัพ", "หน้าดิน": "คันหน้าดิน / อัดบึก",
  "เบทฟิเนส / BFS": "คันตีเหยื่อเบา / เบทฟิเนส", "ฟร็อก": "คันตีเหยื่อปลอม",
  "ดีพดรอป": "คันหน้าดินเรือ / ตกน้ำลึก", "สำหรับรอกไฟฟ้า": "คันรอกไฟฟ้า",
  "สแตนด์อัพ": "คันเกมใหญ่ / สแตนด์อัพ", "ทรอลลิ่ง": "คันลากเหยื่อ / ทรอลลิ่ง",
  "ชิงหลิว / คันทุ่น": "ชิงหลิว / คันทุ่น",
  // รอก
  "สปินนิ่ง": "รอกสปินนิ่ง", "เบทโปรไฟล์ต่ำ": "รอกหยดน้ำ / เบทโปรไฟล์ต่ำ",
  "รอกกลม": "รอกเบทกลม / รอกทะเล", "โอเวอร์เฮด (Lever / Star Drag)": "รอกเบทกลม / รอกทะเล",
  "ฟลาย": "รอกฟลาย", "สปินแคสต์": "รอกกระปุก",
  // สาย
  "PE / ถัก": "สายพีอี / สายถัก", "โมโน": "สายเอ็น / โมโน", "ฟลูออโร": "สายฟลูออโร / สายหน้า",
  "ช็อคลีดเดอร์": "สายช็อคลีด", "สายฟลาย": "สายฟลาย / แบ็คกิ้ง / ทิพเพ็ท",
  "สายลวด": "สายสลิง / กันฟันปลา", "Hollow Core": "สายพีอี / สายถัก",
  // เหยื่อ
  "เหยื่อแข็ง": "เหยื่อแข็ง / ปลั๊ก", "มินโนว์": "มินโนว์ / ปลั๊กลอย", "แครงค์เบต": "ปลั๊กมีลิ้น / แครงค์",
  "แชด": "อื่นๆ", "ไวเบรชัน / ลิปเลส": "กระดี่ / เหยื่อสั่น", "เพนซิล": "เพนซิล", "ป็อปเปอร์": "ป๊อปเปอร์",
  "สติกเบต": "สติ๊กเบท", "เวคเบต": "อื่นๆ", "สวิมเบตแข็ง": "สวิมเบท", "ไกลด์เบต": "อื่นๆ", "จอยต์เบต": "เหยื่อข้อต่อ / จอยท์",
  "จิ๊ก": "เหยื่อจิ๊ก", "สปินเนอร์ / เบลด": "สปินเนอร์ / เหยื่อใบเบลด", "สปูน / ใบโพ": "สปูน", "โยกุ้ง / Egi": "เหยื่อตกหมึก",
  // เหยื่อจริงเดิม
  "สด": "อื่นๆ", "เป็น": "อื่นๆ", "แช่แข็ง": "เหยื่อแช่แข็ง", "หมัก": "เหยื่อหมัก / เหยื่อผสมตกบ่อ",
  "หัวเชื้อ": "หัวเชื้อ / กลิ่นล่อ", "สำเร็จ": "อื่นๆ",
  // ปลายสาย
  "เบ็ดเดี่ยว": "เบ็ดเดี่ยวทั่วไป", "สามทาง": "เบ็ดสามทาง", "Assist Hook": "แอสซิสฮุค",
  "ตะกั่ว": "ตะกั่ว / ลูกถ่วง", "Solid/Split Ring": "แหวน / สปลิทริง", "กิ๊บ": "กิ๊บ / สแน็ป",
  "ริกสำเร็จ": "ชุดผูกสำเร็จ", "ลูกปัด": "ลูกปัด / สต็อปเปอร์", "สต็อปเปอร์": "ลูกปัด / สต็อปเปอร์",
};

function validPath(path) {
  let n = CATEGORY_TREE;
  for (let i = 0; i < path.length; i++) {
    const k = path[i];
    if (Array.isArray(n)) return n.includes(k) && i === path.length - 1;
    if (n && typeof n === "object") { if (!(k in n)) return false; n = n[k]; }
    else return false;
  }
  return true;
}
// หาโหนดชื่อนี้ที่ไหนก็ได้ใต้ main ที่กำหนด → คืน path เต็ม
function findUnder(main, name) {
  const hits = [];
  (function walk(n, p) {
    if (Array.isArray(n)) { n.forEach(x => { if (x === name) hits.push([...p, x]); }); return; }
    if (n && typeof n === "object") for (const [k, v] of Object.entries(n)) {
      if (k === name) hits.push([...p, k]);
      walk(v, [...p, k]);
    }
  })(CATEGORY_TREE[main], [main]);
  return hits.length === 1 ? hits[0] : null; // เจอหลายที่ = ไม่เดา
}

const resp = await fetch(`${URL_}/rest/v1/products?select=id,name,cat_main,cat_sub&order=id`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
const rows = await resp.json();
if (!resp.ok) { console.log("ดึงข้อมูลพัง", rows); process.exit(1); }

let changed = 0, kept = 0;
for (const r of rows) {
  const oldMain = r.cat_main || "";
  const main = MAIN_MAP[oldMain] || oldMain;
  const segs = (r.cat_sub ? r.cat_sub.split(" › ") : []).map(x => SEG_MAP[x.trim()] ?? x.trim());
  let path = [main, ...segs];
  if (!validPath(path)) {
    // ลอง: หา segment สุดท้ายที่ map แล้ว ใต้ main
    const last = segs[segs.length - 1];
    const found = last ? findUnder(main, last) : null;
    if (found) path = found;
    else { // ตัดท้ายทีละชั้นจนกว่าจะ valid
      while (path.length > 1 && !validPath(path)) path = path.slice(0, -1);
      if (!validPath(path)) path = ["อื่นๆ / ไม่เข้าหมวด"];
    }
  }
  const newMain = path[0], newSub = path.slice(1).join(" › ") || null;
  if (newMain === r.cat_main && (newSub || null) === (r.cat_sub || null)) { kept++; continue; }
  changed++;
  console.log(`#${r.id} ${String(r.name).slice(0, 32)}\n   เดิม: ${r.cat_main}${r.cat_sub ? " › " + r.cat_sub : ""}\n   ใหม่: ${newMain}${newSub ? " › " + newSub : ""}`);
  if (APPLY) {
    const u = await fetch(`${URL_}/rest/v1/products?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ cat_main: newMain, cat_sub: newSub }),
    });
    if (!u.ok) console.log(`   ❌ เขียนไม่สำเร็จ HTTP ${u.status}`);
  }
}
console.log("─".repeat(46));
console.log(`ทั้งหมด ${rows.length} · ต้องย้าย ${changed} · เดิมใช้ได้ ${kept} · โหมด: ${APPLY ? "✍️ เขียนจริงแล้ว" : "👀 dry-run (เติม --apply เพื่อเขียนจริง)"}`);
