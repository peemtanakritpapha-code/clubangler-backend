// scripts/imgopt-backfill.mjs — IMGOPT-BACKFILL: บีบรูปเก่าใน bucket "products" ย้อนหลัง
// เป้าหมาย: ลด Cached Egress (รูปดิบ 3MB+ ถูกส่งให้คนดูซ้ำๆ) — อัปทับ path เดิม URL ไม่เปลี่ยน DB ไม่ต้องแก้
//
// ความปลอดภัย (บทเรียน sweep เก่า — ข้อมูลหายถาวรมาแล้ว):
//   1) สองจังหวะ: `node scripts/imgopt-backfill.mjs` = สแกนอย่างเดียว เขียนแผนลงไฟล์ ไม่แตะอะไร
//                  `node scripts/imgopt-backfill.mjs run` = ทำตามแผน ทีละไฟล์
//   2) ทุกไฟล์ถูกดาวน์โหลดเก็บลง backups\ ก่อนอัปทับเสมอ — พังตรงไหนกู้ได้ทุกไฟล์
//   3) แตะเฉพาะ bucket "products" และข้าม profile/ + order-evidence/ (หลักฐานการเงิน ห้ามแตะ)
//   4) บีบเฉพาะ .jpg .jpeg .png ที่ใหญ่กว่า 400KB — webp (ของใหม่ที่บีบแล้ว) ไม่โดนซ้ำ
//   5) บีบแล้วต้องเล็กลงจริง (เหลือ <90% ของเดิม) ถึงจะอัปทับ ไม่งั้นข้าม
//
// ติดตั้งก่อนรันครั้งแรก:  npm i sharp --no-save
// รัน:  node scripts/imgopt-backfill.mjs        (สแกน + สร้างแผน)
//       node scripts/imgopt-backfill.mjs run    (ลงมือตามแผน)

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

let sharp;
try { sharp = (await import("sharp")).default; }
catch { console.log("❌ ยังไม่มี sharp — รันก่อน: npm i sharp --no-save"); process.exit(1); }

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const BUCKET = "products";
const EXCLUDE_PREFIX = ["profile", "order-evidence"]; // ห้ามแตะเด็ดขาด
const MIN_SIZE = 400 * 1024;                          // เล็กกว่านี้ไม่คุ้มบีบ
const EXT_OK = new Set([".jpg", ".jpeg", ".png"]);
const PLAN_FILE = "backfill-plan.json";
const kb = n => (n / 1024).toFixed(1) + " KB";
const mb = n => (n / 1024 / 1024).toFixed(2) + " MB";

// โพสต์ = 1280px q80 · สินค้า/โฟลเดอร์เก่า = 1600px q82 (มือสองต้องซูมดูสภาพ)
const ruleFor = p => p.startsWith("post-imgs/") ? { maxEdge: 1280, quality: 80 } : { maxEdge: 1600, quality: 82 };

// ---- ไล่ทุกไฟล์ทุกชั้นใน bucket (อ่านอย่างเดียว) ----
async function walk(prefix = "") {
  const out = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 100, offset: page * 100 });
    if (error) { console.log(`[WARN] list ${prefix || "(root)"}: ${error.message}`); break; }
    if (!data.length) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...await walk(full));        // โฟลเดอร์ → ลงลึกต่อ
      else out.push({ path: full, size: item.metadata?.size ?? 0 });
    }
    if (data.length < 100) break;
  }
  return out;
}

const mode = process.argv[2] || "scan";

if (mode === "scan") {
  console.log(`สแกน bucket "${BUCKET}" (ข้าม: ${EXCLUDE_PREFIX.join(", ")}) ...`);
  const all = await walk();
  const plan = all.filter(f =>
    !EXCLUDE_PREFIX.some(x => f.path.startsWith(x + "/") || f.path === x) &&
    EXT_OK.has(path.extname(f.path).toLowerCase()) &&
    f.size > MIN_SIZE
  );
  const totalAll = all.reduce((s, f) => s + f.size, 0);
  const totalPlan = plan.reduce((s, f) => s + f.size, 0);
  console.log(`\nไฟล์ทั้ง bucket: ${all.length} ไฟล์ รวม ${mb(totalAll)}`);
  console.log(`เข้าเกณฑ์บีบ:   ${plan.length} ไฟล์ รวม ${mb(totalPlan)}\n`);
  for (const f of plan) console.log(`  ${kb(f.size).padStart(10)}  ${f.path}`);
  fs.writeFileSync(PLAN_FILE, JSON.stringify({ at: new Date().toISOString(), bucket: BUCKET, files: plan }, null, 1));
  console.log(`\n✅ เขียนแผนลง ${PLAN_FILE} แล้ว — ตรวจรายชื่อด้านบนให้ชัวร์ แล้วค่อยรัน:  node scripts/imgopt-backfill.mjs run`);
  process.exit(0);
}

if (mode !== "run") { console.log("โหมดไม่รู้จัก — ใช้: (ว่าง=สแกน) หรือ run"); process.exit(1); }

// ---- โหมด run: backup → บีบ → อัปทับ → ตรวจ ทีละไฟล์ ----
if (!fs.existsSync(PLAN_FILE)) { console.log(`❌ ไม่พบ ${PLAN_FILE} — รันโหมดสแกนก่อน`); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
const BAK = path.join("backups", `imgopt-backfill_${stamp}`);
const report = { at: new Date().toISOString(), backupDir: BAK, done: [], skipped: [], failed: [] };
console.log(`ไฟล์ตามแผน: ${plan.files.length} — backup ทุกไฟล์ลง ${BAK}\\ ก่อนแตะเสมอ\n`);

for (const [i, f] of plan.files.entries()) {
  const tag = `[${i + 1}/${plan.files.length}] ${f.path}`;
  try {
    // 1) ดาวน์โหลดต้นฉบับ
    const { data, error } = await db.storage.from(BUCKET).download(f.path);
    if (error) throw new Error("download: " + error.message);
    const orig = Buffer.from(await data.arrayBuffer());

    // 2) backup ลงเครื่องก่อนแตะ
    const bakPath = path.join(BAK, f.path.replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(bakPath), { recursive: true });
    fs.writeFileSync(bakPath, orig);

    // 3) บีบ: หมุนตาม EXIF + ย่อขอบยาวสุด + JPEG (พื้น PNG ใสถมขาว)
    const { maxEdge, quality } = ruleFor(f.path);
    const out = await sharp(orig).rotate()
      .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    // 4) เล็กลงจริงไหม — ไม่ถึง 10% ไม่คุ้มเสี่ยง ข้าม
    if (out.length >= orig.length * 0.9) {
      console.log(`⏭️  ${tag} — บีบแล้วไม่เล็กลงพอ (${kb(orig.length)} → ${kb(out.length)}) ข้าม`);
      report.skipped.push({ path: f.path, before: orig.length, after: out.length });
      continue;
    }

    // 5) อัปทับ path เดิม (URL เดิมทุกอย่าง)
    const { error: upErr } = await db.storage.from(BUCKET)
      .upload(f.path, out, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
    if (upErr) throw new Error("upload: " + upErr.message);

    // 6) ตรวจซ้ำว่าขนาดบนเซิร์ฟเวอร์ = ที่เพิ่งอัป
    const { data: chk, error: chkErr } = await db.storage.from(BUCKET).download(f.path);
    if (chkErr) throw new Error("verify: " + chkErr.message);
    const chkLen = (await chk.arrayBuffer()).byteLength;
    if (chkLen !== out.length) throw new Error(`verify: ขนาดไม่ตรง (${chkLen} != ${out.length})`);

    console.log(`✅ ${tag} — ${kb(orig.length)} → ${kb(out.length)}`);
    report.done.push({ path: f.path, before: orig.length, after: out.length });
  } catch (e) {
    console.log(`❌ ${tag} — ${e.message} (ต้นฉบับยังอยู่ครบ ทั้งบนเซิร์ฟเวอร์และใน backup)`);
    report.failed.push({ path: f.path, error: e.message });
  }
}

const b = report.done.reduce((s, r) => s + r.before, 0), a = report.done.reduce((s, r) => s + r.after, 0);
console.log(`\n===== สรุป =====`);
console.log(`สำเร็จ ${report.done.length} · ข้าม ${report.skipped.length} · พลาด ${report.failed.length}`);
console.log(`ขนาดรวมไฟล์ที่บีบ: ${mb(b)} → ${mb(a)} (ประหยัด ${b ? Math.round((1 - a / b) * 100) : 0}%)`);
console.log(`backup ต้นฉบับทั้งหมดอยู่ที่: ${BAK}\\`);
fs.writeFileSync("backfill-report.json", JSON.stringify(report, null, 1));
console.log(`รายงานละเอียด: backfill-report.json`);
