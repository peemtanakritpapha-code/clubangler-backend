// scripts/set-avatars.mjs — สุ่มแจกรูปโปรไฟล์ให้บัญชีที่ยังไม่มี avatar
// เตรียมรูป (.jpg/.png/.webp) ไว้ใน restore-imgs\ ที่รากโปรเจกต์ก่อน
// รันดูก่อน:  node scripts/set-avatars.mjs
// แจกจริง:   node scripts/set-avatars.mjs --confirm SET-AVATARS
// หมายเหตุ: อัพเข้าโฟลเดอร์ profile/ ใน bucket products (โครงใหม่ตาม STORE-SPLIT)
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const CONFIRM = process.argv.includes("--confirm") && process.argv[process.argv.indexOf("--confirm") + 1] === "SET-AVATARS";

const DIR = "restore-imgs";
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

if (!fs.existsSync(DIR)) { console.log(`[FAIL] ไม่พบโฟลเดอร์ ${DIR}\\ — สร้างแล้ววางรูปก่อน`); process.exit(1); }
const files = fs.readdirSync(DIR).filter(f => MIME[path.extname(f).toLowerCase()]);
if (!files.length) { console.log(`[FAIL] ไม่มีรูป (.jpg/.png/.webp) ใน ${DIR}\\`); process.exit(1); }

const { data: profs, error } = await db.from("profiles").select("id, name, avatar_path").is("avatar_path", null);
if (error) { console.log("[FAIL] profiles:", error.message); process.exit(1); }
if (!profs.length) { console.log("[OK] ทุกโปรไฟล์มีรูปแล้ว — ไม่มีอะไรต้องทำ"); process.exit(0); }

// สับไพ่รูป แล้วแจกวน (รูปน้อยกว่าคนก็วนซ้ำ)
const deck = [...files].sort(() => Math.random() - 0.5);
const pairs = profs.map((p, i) => ({ p, file: deck[i % deck.length] }));

console.log("========== SET-AVATARS ==========");
console.log(`รูปในโฟลเดอร์: ${files.length} | โปรไฟล์ที่ยังไม่มีรูป: ${profs.length}\n`);
for (const { p, file } of pairs) console.log(`  ${p.name || p.id} ← ${file}`);

if (!CONFIRM) {
  console.log("\n>>> โหมดดูอย่างเดียว (สุ่มใหม่ทุกครั้งที่รัน) — แจกจริง: node scripts/set-avatars.mjs --confirm SET-AVATARS");
  process.exit(0);
}

let ok = 0;
for (const { p, file } of pairs) {
  const ext = path.extname(file).toLowerCase();
  const dest = `profile/${p.id}/avatar-${Date.now()}${ext}`;
  const { error: upErr } = await db.storage.from("products")
    .upload(dest, fs.readFileSync(path.join(DIR, file)), { contentType: MIME[ext], upsert: true });
  if (upErr) { console.log(`[WARN] ${p.name}: อัพรูปไม่สำเร็จ — ${upErr.message}`); continue; }
  const url = db.storage.from("products").getPublicUrl(dest).data.publicUrl;
  const { error: updErr } = await db.from("profiles").update({ avatar_path: url }).eq("id", p.id);
  if (updErr) { console.log(`[WARN] ${p.name}: อัปเดตโปรไฟล์ไม่สำเร็จ — ${updErr.message}`); continue; }
  console.log(`[OK] ${p.name} ← ${file}`);
  ok++;
}
console.log(`\n========== เสร็จ ${ok}/${pairs.length} — รีเฟรชหน้าฟีดดูผล ==========`);
