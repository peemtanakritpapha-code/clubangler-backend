// scripts/dispute-clip-archive.mjs — ARCHIVE: โหลดคลิปเปิดกล่องของเคสที่จบแล้ว (เกินวันเก็บ) มาเก็บที่เครื่อง แล้วลบออกจาก server
// รัน: node scripts/dispute-clip-archive.mjs   (แนะนำเดือนละครั้ง คู่กับ backup.mjs)
// เกณฑ์ "เคสจบแล้ว": refunded_at มีค่า (จบแบบคืนเงิน 6a/6b) หรือ dispute_closed_at มีค่า (จบแบบถูกปฏิเสธ 6c)
// เกณฑ์ "เกินวันเก็บ": วันที่จบ + dispute_video_retention_days (จาก platform_config) ผ่านมาแล้ว
// ขั้นตอนต่อไฟล์: โหลดมาเก็บเครื่องก่อน → เช็คว่าเซฟลงดิสก์สำเร็จจริง → ค่อยลบจาก storage + เคลียร์คอลัมน์ในตาราง (กันโหลดซ้ำเดือนถัดไป)
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "products"; // คลิปเก็บในบัคเก็ตนี้ โฟลเดอร์ order-evidence/ (เหมือนรูปหลักฐาน)

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// แปลง public URL กลับเป็น path ภายใน bucket (ตอนอัปโหลดเราเก็บแค่ URL เต็มไว้ในคอลัมน์ ไม่ได้เก็บ path แยก)
function pathFromPublicUrl(url, bucket) {
  const marker = `/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length));
}

const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const ROOT = path.join("dispute-archive", stamp);
fs.mkdirSync(ROOT, { recursive: true });

// ---- 1) อ่านค่าวันเก็บจาก platform_config จริง (ไม่ hardcode) ----
const { data: cfgRows, error: cfgErr } = await db.from("platform_config").select("dispute_video_retention_days").limit(1);
if (cfgErr) { console.log(`[FAIL] อ่าน platform_config ไม่ได้: ${cfgErr.message}`); process.exit(1); }
const RETENTION_DAYS = Number(cfgRows?.[0]?.dispute_video_retention_days) || 30;
console.log(`[INFO] วันเก็บคลิปหลังปิดเคส: ${RETENTION_DAYS} วัน`);

// ---- 2) หาออเดอร์ที่มีคลิป + เคสจบแล้ว (คืนเงินแล้ว หรือ ถูกปฏิเสธแล้ว) ----
const cutoffMs = RETENTION_DAYS * 86400000;
const now = Date.now();

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("orders")
    .select("id, order_no, evidence_video_path, dispute_closed_at, refunded_at")
    .not("evidence_video_path", "is", null)
    .or("dispute_closed_at.not.is.null,refunded_at.not.is.null")
    .range(from, from + 999);
  if (error) { console.log(`[FAIL] ดึงออเดอร์ไม่ได้: ${error.message}`); process.exit(1); }
  rows.push(...data);
  if (data.length < 1000) break;
}

const due = rows.filter(o => {
  const closedAt = o.dispute_closed_at || o.refunded_at; // อันไหนมีก็ใช้อันนั้น (ทาง B — ไม่ต้องแก้ production)
  if (!closedAt) return false;
  return now - new Date(closedAt).getTime() >= cutoffMs;
});

console.log(`[INFO] เจอออเดอร์มีคลิป+เคสจบแล้วทั้งหมด ${rows.length} ใบ — ครบกำหนดลบ ${due.length} ใบ`);

// ---- 3) โหลดมาเก็บเครื่องก่อน → สำเร็จค่อยลบจาก storage + เคลียร์คอลัมน์ ----
let archived = 0, deleted = 0, failed = 0;
for (const o of due) {
  const filePath = pathFromPublicUrl(o.evidence_video_path, BUCKET);
  if (!filePath) { console.log(`[WARN] ออเดอร์ ${o.order_no}: แกะ path จาก URL ไม่ได้ — ข้าม`); failed++; continue; }

  const { data: fileData, error: dlErr } = await db.storage.from(BUCKET).download(filePath);
  if (dlErr) { console.log(`[WARN] ออเดอร์ ${o.order_no}: โหลดคลิปไม่ได้ (${dlErr.message}) — ข้าม ไม่ลบ`); failed++; continue; }

  const ext = (filePath.split(".").pop() || "mp4").toLowerCase();
  const dest = path.join(ROOT, `${o.order_no}.${ext}`);
  fs.writeFileSync(dest, Buffer.from(await fileData.arrayBuffer()));
  archived++;

  const { error: rmErr } = await db.storage.from(BUCKET).remove([filePath]);
  if (rmErr) { console.log(`[WARN] ออเดอร์ ${o.order_no}: เซฟเครื่องสำเร็จแต่ลบจาก storage ไม่ได้ (${rmErr.message}) — เช็คมือทีหลัง`); continue; }

  const { error: updErr } = await db.from("orders").update({ evidence_video_path: null }).eq("id", o.id);
  if (updErr) { console.log(`[WARN] ออเดอร์ ${o.order_no}: ลบไฟล์แล้วแต่เคลียร์คอลัมน์ไม่ได้ (${updErr.message}) — เช็คมือทีหลัง`); continue; }

  deleted++;
  console.log(`[OK] ออเดอร์ ${o.order_no}: เซฟ → ${dest} แล้วลบออกจาก server แล้ว`);
}

console.log(`\n========== ARCHIVE เสร็จ ==========`);
console.log(`เซฟลงเครื่อง: ${archived} ไฟล์ | ลบออกจาก server สำเร็จ: ${deleted} ไฟล์ | ข้าม/พลาด: ${failed}`);
console.log(`โฟลเดอร์: ${ROOT}`);
if (archived > deleted) console.log(`⚠ มี ${archived - deleted} ไฟล์ที่เซฟเครื่องสำเร็จแต่ลบ/เคลียร์บน server ไม่ครบ — เช็ค log ด้านบน`);
