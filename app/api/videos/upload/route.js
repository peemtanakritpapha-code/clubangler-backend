// V4-KEEP-AUDIO
// app/api/videos/upload/route.js — V2: รับคลิป → ffmpeg ตัดเสียง+ทำภาพปก → อัปขึ้น R2 → บันทึก videos
// สเปกที่เคาะไว้: ยาวสุด 60 วิ / ไฟล์ไม่เกิน 100MB / เก็บเสียงไว้ + เตือนห้ามใช้เพลงลิขสิทธิ์ตอนอัป (V4)
// moderation: ขึ้นฟีดทันที ไม่ต้องรอแอดมินตรวจก่อน (เคาะไว้แล้ว) — V5 จะเพิ่มปุ่มลบ+report ทีหลัง
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2 } from "@/lib/r2";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

const MAX_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_SEC = 60;
const OK_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("banned_at").eq("id", user.id).single();
  if (prof?.banned_at)
    return NextResponse.json({ error: "บัญชีของคุณถูกระงับการใช้งานชุมชน" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const productIdRaw = form.get("productId");
  const productId = productIdRaw ? Number(productIdRaw) : null;

  if (!file || typeof file === "string")
    return NextResponse.json({ error: "ไม่พบไฟล์วิดีโอ" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 100MB" }, { status: 400 });
  if (!OK_TYPES.includes(file.type))
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์วิดีโอ (mp4/mov/webm)" }, { status: 400 });

  // แนบสินค้า: ต้องเป็นสินค้าของตัวเองจริง (กันยิง id สินค้าคนอื่น — เหมือน posts/create)
  if (productId) {
    const { data: prod } = await admin.from("products").select("id, seller_id").eq("id", productId).single();
    if (!prod || prod.seller_id !== user.id)
      return NextResponse.json({ error: "แนบได้เฉพาะสินค้าของคุณเอง" }, { status: 400 });
  }

  const dir = await mkdtemp(path.join(tmpdir(), "vid-"));
  const inPath = path.join(dir, "in" + (path.extname(file.name) || ".mp4"));
  const outPath = path.join(dir, "out.mp4");
  const thumbPath = path.join(dir, "thumb.jpg");

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(inPath, buf);

    // เช็คความยาวคลิปก่อนประมวลผล (กันคลิปยาวเกินสเปกตั้งแต่ต้น)
    let duration = 0;
    try {
      const { stdout: durOut } = await execFileAsync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", inPath,
      ]);
      duration = parseFloat(durOut.trim());
    } catch {
      return NextResponse.json({ error: "อ่านไฟล์วิดีโอไม่สำเร็จ ไฟล์อาจเสียหรือไม่ใช่วิดีโอ" }, { status: 400 });
    }
    if (!duration || duration > MAX_SEC + 1)
      return NextResponse.json({ error: `คลิปต้องยาวไม่เกิน ${MAX_SEC} วินาที` }, { status: 400 });

    // V4: เก็บเสียงไว้ (เลิกตัดอัตโนมัติ) + faststart ให้เล่นบนเว็บลื่น
    // -c copy = ก็อปทั้งวิดีโอ+เสียงเดิม ไม่ encode ใหม่ → เร็วมาก ไม่กิน CPU
    await execFileAsync("ffmpeg", [
      "-y", "-i", inPath, "-c", "copy", "-movflags", "+faststart", outPath,
    ]);

    // ภาพปกจากเฟรมแรก ย่อกว้าง 480px (ไฟล์เล็ก โหลดไว)
    await execFileAsync("ffmpeg", [
      "-y", "-i", outPath, "-ss", "00:00:00.1", "-vframes", "1", "-vf", "scale=480:-2", thumbPath,
    ]);

    const key = crypto.randomUUID();
    const videoBuf = await readFile(outPath);
    const thumbBuf = await readFile(thumbPath);

    const videoUrl = await uploadToR2(`clips/${key}.mp4`, videoBuf, "video/mp4");
    const thumbUrl = await uploadToR2(`clips/${key}.jpg`, thumbBuf, "image/jpeg");

    const { data: row, error } = await admin.from("videos").insert({
      owner_id: user.id,
      product_id: productId,
      url: videoUrl,
      thumb_url: thumbUrl,
      duration_sec: duration,
      size_bytes: videoBuf.length,
    }).select("id, url, thumb_url").single();

    if (error) {
      console.error("videos/upload insert:", error);
      return NextResponse.json({ error: "บันทึกคลิปไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, video: row });
  } catch (err) {
    console.error("videos/upload:", err);
    return NextResponse.json(
      { error: "ประมวลผลคลิปไม่สำเร็จ ลองใหม่อีกครั้ง (ตรวจว่าไฟล์เป็นวิดีโอจริง)" },
      { status: 500 }
    );
  } finally {
    await Promise.allSettled([unlink(inPath), unlink(outPath), unlink(thumbPath)]);
  }
}
