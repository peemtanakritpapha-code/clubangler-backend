// scripts/restore.mjs — RESTORE: กู้ข้อมูลจากโฟลเดอร์ backup กลับเข้า Supabase
// ดูของใน backup:  node scripts/restore.mjs backups\2026-07-13_0130
// กู้จริง:          node scripts/restore.mjs backups\2026-07-13_0130 --confirm RESTORE
// พฤติกรรม: เติม/ทับแถวตาม id (upsert) + อัพไฟล์กลับทุก bucket — "ไม่ลบ" ของที่มีอยู่แล้วในระบบ
// นี่คือเครื่องมือฉุกเฉินตอนข้อมูลหาย ไม่ใช่เครื่องย้อนเวลา
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const ROOT = process.argv[2];
const CONFIRM = process.argv.includes("--confirm") && process.argv[process.argv.indexOf("--confirm") + 1] === "RESTORE";
if (!ROOT || !fs.existsSync(ROOT)) { console.log("[FAIL] ระบุโฟลเดอร์ backup เช่น: node scripts/restore.mjs backups\\2026-07-13_0130"); process.exit(1); }

// ลำดับสำคัญ: แม่ก่อนลูก (โปรไฟล์ → สินค้า → ออเดอร์/โพสต์ → คอมเมนต์/ไลก์)
const ORDER = [
  "profiles", "banned_words", "fee_tiers", "platform_config", "catalog_extras",
  "products", "addresses", "orders", "posts", "post_comments", "post_likes",
  "notifications", "follows", "reports", "user_blocks", "ai_usage",
];
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf" };

// ---- สำรวจของใน backup ----
const dbDir = path.join(ROOT, "db"), stDir = path.join(ROOT, "storage");
const plan = [];
for (const t of ORDER) {
  const f = path.join(dbDir, `${t}.json`);
  if (!fs.existsSync(f)) continue;
  const rows = JSON.parse(fs.readFileSync(f, "utf8"));
  if (rows.length) plan.push({ t, rows });
}
const filePlan = [];
function walkLocal(dir, rel = "") {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name), r = rel ? `${rel}/${name}` : name;
    if (fs.statSync(p).isDirectory()) walkLocal(p, r);
    else filePlan.push({ p, r });
  }
}
let buckets = [];
if (fs.existsSync(stDir)) buckets = fs.readdirSync(stDir);

console.log(`========== RESTORE จาก ${ROOT} ==========`);
for (const { t, rows } of plan) console.log(`  ตาราง ${t}: ${rows.length} แถว`);
for (const b of buckets) { filePlan.length = 0; walkLocal(path.join(stDir, b)); console.log(`  bucket ${b}: ${filePlan.length} ไฟล์`); }

if (!CONFIRM) {
  console.log("\n>>> โหมดดูอย่างเดียว — กู้จริง: node scripts/restore.mjs " + ROOT + " --confirm RESTORE");
  process.exit(0);
}

// ---- กู้ตาราง ----
for (const { t, rows } of plan) {
  let ok = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await db.from(t).upsert(chunk, { onConflict: "id" });
    if (error) { console.log(`[WARN] ${t}: ${error.message}`); continue; }
    ok += chunk.length;
  }
  console.log(`[OK] ตาราง ${t}: กู้ ${ok}/${rows.length}`);
}

// ---- กู้ไฟล์ ----
for (const b of buckets) {
  filePlan.length = 0;
  walkLocal(path.join(stDir, b));
  let ok = 0;
  for (const { p, r } of filePlan) {
    const ext = path.extname(r).toLowerCase();
    const { error } = await db.storage.from(b).upload(r, fs.readFileSync(p), { contentType: MIME[ext] || "application/octet-stream", upsert: true });
    if (error) { console.log(`[WARN] ${b}/${r}: ${error.message}`); continue; }
    ok++;
  }
  console.log(`[OK] bucket ${b}: กู้ ${ok}/${filePlan.length} ไฟล์`);
}
console.log("\n========== RESTORE เสร็จ ==========");
