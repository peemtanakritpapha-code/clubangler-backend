// scripts/purge-storage-sweep.mjs — กวาดไฟล์ค้างใน bucket products + slips ให้เกลี้ยง
// ปลอดภัยเพราะ: products=0 orders=0 → ทุกไฟล์ใน 2 bucket นี้คือ orphan แน่นอน
// มีด่านกันเผลอ: ถ้า DB ไม่ว่างจริง สคริปต์จะไม่ยอมลบ
// รันดูก่อน:  node scripts/purge-storage-sweep.mjs
// ลบจริง:    node scripts/purge-storage-sweep.mjs --confirm SWEEP
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const CONFIRM = process.argv.includes("--confirm") && process.argv[process.argv.indexOf("--confirm") + 1] === "SWEEP";

// ---- ด่านกันเผลอ: DB ต้องว่างจริง ----
for (const t of ["products", "orders"]) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  if (error) { console.log(`[FAIL] เช็ค ${t}:`, error.message); process.exit(1); }
  if (count !== 0) { console.log(`[STOP] ${t} มี ${count} แถว — ไม่ว่างจริง ห้ามกวาด storage`); process.exit(1); }
}
console.log("[OK] ด่านกันเผลอผ่าน: products=0 orders=0 → ทุกไฟล์ใน bucket คือ orphan\n");

// ---- ไล่เก็บ path ไฟล์ทุกชั้น (โฟลเดอร์ = ไม่มี id, ไฟล์ = มี id) ----
async function walk(bucket, prefix = "") {
  const out = [];
  let page = 0;
  while (true) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100, offset: page * 100 });
    if (error) { console.log(`[FAIL] list ${bucket}/${prefix}:`, error.message); process.exit(1); }
    if (!data.length) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) out.push(full);
      else out.push(...await walk(bucket, full));
    }
    if (data.length < 100) break;
    page++;
  }
  return out;
}

for (const bucket of ["products", "slips"]) {
  const files = await walk(bucket);
  console.log(`bucket ${bucket}: เจอไฟล์ค้าง ${files.length} ไฟล์`);
  if (!CONFIRM || !files.length) continue;
  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100);
    const { error } = await db.storage.from(bucket).remove(chunk);
    if (error) console.log(`[WARN] ลบ ${bucket} บางส่วนไม่สำเร็จ:`, error.message);
    else console.log(`[OK] ลบ ${bucket} ${chunk.length} ไฟล์`);
  }
}

console.log(CONFIRM
  ? "\n========== กวาดเสร็จ — รัน node scripts/purge-verify.mjs ซ้ำ ควรเหลือ 0 รายการทั้ง 2 bucket =========="
  : "\n>>> โหมดดูอย่างเดียว — ลบจริง: node scripts/purge-storage-sweep.mjs --confirm SWEEP");
