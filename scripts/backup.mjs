// scripts/backup.mjs — BACKUP: ดูดฐานข้อมูลทุกตาราง + ไฟล์ทุก bucket ลงเครื่อง
// รัน: node scripts/backup.mjs
// ผลลัพธ์: โฟลเดอร์ backups\2026-07-13_1530\ (db เป็น .json + storage เป็นไฟล์จริง + manifest สรุป)
// *** อ่านอย่างเดียวทั้งสคริปต์ — ไม่มีคำสั่งลบ/แก้ใดๆ ***
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const TABLES = [
  "profiles", "products", "orders", "posts", "post_comments", "post_likes",
  "notifications", "addresses", "follows", "kyc", "slips", "reports",
  "user_blocks", "banned_words", "fee_tiers", "platform_config", "catalog_extras", "ai_usage",
];
const BUCKETS = ["products", "slips", "kyc"];

const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
const ROOT = path.join("backups", stamp);
fs.mkdirSync(path.join(ROOT, "db"), { recursive: true });
const manifest = { at: new Date().toISOString(), tables: {}, buckets: {} };

// ---- 1) ตาราง: ดึงเป็นหน้าละ 1000 จนหมด (กันชนเพดาน Supabase) ----
for (const t of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(t).select("*").range(from, from + 999);
    if (error) { console.log(`[WARN] ข้ามตาราง ${t}: ${error.message}`); rows.length = 0; break; }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  fs.writeFileSync(path.join(ROOT, "db", `${t}.json`), JSON.stringify(rows, null, 1));
  manifest.tables[t] = rows.length;
  console.log(`[OK] ตาราง ${t}: ${rows.length} แถว`);
}

// ---- 2) storage: ไล่ทุกไฟล์ทุกชั้น แล้วดาวน์โหลด ----
async function walk(bucket, prefix = "") {
  const out = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100, offset: page * 100 });
    if (error) { console.log(`[WARN] list ${bucket}/${prefix}: ${error.message}`); break; }
    if (!data.length) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) out.push(full);
      else out.push(...await walk(bucket, full));
    }
    if (data.length < 100) break;
  }
  return out;
}

for (const bucket of BUCKETS) {
  const files = await walk(bucket);
  let ok = 0;
  for (const f of files) {
    const { data, error } = await db.storage.from(bucket).download(f);
    if (error) { console.log(`[WARN] โหลด ${bucket}/${f} ไม่ได้: ${error.message}`); continue; }
    const dest = path.join(ROOT, "storage", bucket, ...f.split("/"));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await data.arrayBuffer()));
    ok++;
  }
  manifest.buckets[bucket] = { found: files.length, saved: ok };
  console.log(`[OK] bucket ${bucket}: เซฟ ${ok}/${files.length} ไฟล์`);
}

fs.writeFileSync(path.join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n========== BACKUP เสร็จ → ${ROOT} ==========`);
console.log("เก็บโฟลเดอร์นี้ไว้ให้ดี — จะก๊อปใส่ USB/Google Drive เพิ่มอีกชั้นก็ยิ่งปลอดภัย");
