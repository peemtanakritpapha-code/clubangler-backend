// scripts/purge-run.mjs — PURGE ตัวลบจริง (ตามเคาะ 13 ก.ค.):
//   ลบ: สินค้าทั้งหมด + ออเดอร์ที่พัน + โพสต์ที่แนบสินค้า (พร้อมไลก์/คอมเมนต์) + รูป bucket products + สลิป bucket slips
//   ไม่แตะ: profiles / kyc / addresses / notifications / platform_config / catalog_extras
// รันดูก่อน (ไม่ลบ):  node scripts/purge-run.mjs
// ลบจริง:            node scripts/purge-run.mjs --confirm DELETE-TEST-DATA
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) { console.log("[FAIL] ไม่พบ env"); process.exit(1); }
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const CONFIRM = process.argv.includes("--confirm") && process.argv[process.argv.indexOf("--confirm") + 1] === "DELETE-TEST-DATA";

// path จาก publicUrl: .../object/public/{bucket}/{path}
const pathFromUrl = (u, bucket) => {
  const mark = `/object/public/${bucket}/`;
  const i = String(u).indexOf(mark);
  return i === -1 ? null : decodeURIComponent(String(u).slice(i + mark.length));
};

// ---------- รวบรวม ----------
const { data: products, error: e1 } = await db.from("products").select("id, name, images");
if (e1) { console.log("[FAIL] products:", e1.message); process.exit(1); }
const pids = products.map(p => p.id);

const { data: orders, error: e2 } = await db.from("orders")
  .select("id, order_no, slip_path, refund_slip_path, payout_slip_path")
  .in("product_id", pids.length ? pids : ["-"]);
if (e2) { console.log("[FAIL] orders:", e2.message); process.exit(1); }

const { data: posts, error: e3 } = await db.from("posts").select("id").in("product_id", pids.length ? pids : ["-"]);
if (e3) { console.log("[FAIL] posts:", e3.message); process.exit(1); }
const postIds = posts.map(p => p.id);

const imgPaths = [];
for (const p of products) for (const u of (p.images || [])) {
  const path = pathFromUrl(u, "products") ?? u; // เผื่อบางแถวเก็บ path ตรงๆ
  if (path) imgPaths.push(path);
}
const slipPaths = [];
for (const o of orders) for (const sp of [o.slip_path, o.refund_slip_path, o.payout_slip_path]) if (sp) slipPaths.push(sp);

console.log("========== PURGE-RUN ==========");
console.log(`จะลบ: สินค้า ${products.length} | ออเดอร์ ${orders.length} | โพสต์ ${postIds.length}`);
console.log(`ไฟล์: รูปสินค้า ${imgPaths.length} | สลิป ${slipPaths.length}`);
console.log("ไม่แตะ: profiles / kyc / addresses / notifications / platform_config / catalog_extras\n");

if (!CONFIRM) {
  console.log(">>> โหมดดูอย่างเดียว ยังไม่ลบ <<<");
  console.log(">>> ลบจริง: node scripts/purge-run.mjs --confirm DELETE-TEST-DATA");
  process.exit(0);
}

// ---------- ลบจริง (ลูกก่อนแม่) ----------
const step = async (label, fn) => {
  const { error, count } = await fn();
  if (error) { console.log(`[FAIL] ${label}:`, error.message, "— หยุดทันที"); process.exit(1); }
  console.log(`[OK] ${label}${count != null ? ` (${count})` : ""}`);
};

if (postIds.length) {
  await step("ลบ post_comments", () => db.from("post_comments").delete({ count: "exact" }).in("post_id", postIds));
  await step("ลบ post_likes", () => db.from("post_likes").delete({ count: "exact" }).in("post_id", postIds));
  await step("ลบ posts", () => db.from("posts").delete({ count: "exact" }).in("id", postIds));
}
if (orders.length)
  await step("ลบ orders", () => db.from("orders").delete({ count: "exact" }).in("id", orders.map(o => o.id)));
if (pids.length)
  await step("ลบ products", () => db.from("products").delete({ count: "exact" }).in("id", pids));

for (const [bucket, paths] of [["products", imgPaths], ["slips", slipPaths]]) {
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error } = await db.storage.from(bucket).remove(chunk);
    if (error) { console.log(`[WARN] ลบไฟล์ ${bucket} บางส่วนไม่สำเร็จ:`, error.message); }
    else console.log(`[OK] ลบไฟล์ ${bucket} ${chunk.length} ไฟล์`);
  }
}

console.log("\n========== เสร็จ — ตรวจซ้ำ: node scripts/purge-scan.mjs (ควรได้ 0 ทุกช่อง) ==========");
