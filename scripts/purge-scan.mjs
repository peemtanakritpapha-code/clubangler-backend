// scripts/purge-scan.mjs — PURGE ขั้นสแกน: ดูว่ามีสินค้าอะไร พันกับอะไร ก่อนลบจริง
// รันจากเครื่อง Windows ที่รากโปรเจกต์: node scripts/purge-scan.mjs
// *** สคริปต์นี้อ่านอย่างเดียว ไม่ลบ ไม่แก้อะไรทั้งสิ้น ***
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) { console.log("[FAIL] ไม่พบ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY ใน .env.local"); process.exit(1); }

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const { data: products, error: e1 } = await db.from("products")
  .select("id, name, status, images, seller_id, created_at")
  .order("created_at", { ascending: true });
if (e1) { console.log("[FAIL] ดึง products ไม่ได้:", e1.message); process.exit(1); }

const ids = products.map(p => p.id);

const { data: orders, error: e2 } = await db.from("orders")
  .select("id, order_no, product_id, status")
  .in("product_id", ids.length ? ids : ["-"]);
if (e2) { console.log("[FAIL] ดึง orders ไม่ได้:", e2.message); process.exit(1); }

const { data: posts, error: e3 } = await db.from("posts")
  .select("id, product_id")
  .in("product_id", ids.length ? ids : ["-"]);
if (e3) { console.log("[FAIL] ดึง posts ไม่ได้:", e3.message); process.exit(1); }

const ordersOf = id => orders.filter(o => String(o.product_id) === String(id));
const postsOf = id => posts.filter(p => String(p.product_id) === String(id));

console.log("========== PURGE-SCAN (อ่านอย่างเดียว) ==========");
console.log(`สินค้าทั้งหมด: ${products.length} ตัว\n`);

let totalImgs = 0;
for (const p of products) {
  const imgs = Array.isArray(p.images) ? p.images.length : 0;
  totalImgs += imgs;
  const ord = ordersOf(p.id), pst = postsOf(p.id);
  const flags = [];
  if (ord.length) flags.push(`⚠️ ออเดอร์พัน ${ord.length} ใบ [${ord.map(o => o.status).join(",")}]`);
  if (pst.length) flags.push(`📌 โพสต์พัน ${pst.length}`);
  console.log(`- ${String(p.id).slice(0, 8)}… | ${p.status} | รูป ${imgs} | ${p.name?.slice(0, 40)} ${flags.join(" ")}`);
}

const byStatus = {};
for (const p of products) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
const oByStatus = {};
for (const o of orders) oByStatus[o.status] = (oByStatus[o.status] || 0) + 1;

console.log("\n---------- สรุป ----------");
console.log("สินค้าแยกสถานะ:", JSON.stringify(byStatus));
console.log(`รูปรวม (จาก products.images): ${totalImgs} ไฟล์`);
console.log(`ออเดอร์ที่อ้างสินค้าเหล่านี้: ${orders.length} ใบ`, JSON.stringify(oByStatus));
console.log(`โพสต์ที่แนบสินค้า: ${posts.length} โพสต์`);
console.log("\n*** ยังไม่มีอะไรถูกลบ — รอเคาะจากรายงานนี้ก่อน ***");
