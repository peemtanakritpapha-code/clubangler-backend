# -*- coding: utf-8 -*-
# patch-imgopt1.py — IMGOPT เฟส 1: บีบอัดรูปอัตโนมัติก่อนอัปโหลด
# ทำ 3 อย่าง:
#   1) สร้าง lib/imageTools.js (helper บีบรูปด้วย canvas ฝั่ง client)
#   2) SellClient.js: บีบรูปสินค้า 1600px q0.82 ใน loop อัปโหลด
#   3) FeedClient.js (Composer): บีบรูปโพสต์ 1280px q0.8 ใน loop อัปโหลด
# กติกา: anchor เดี่ยวบรรทัดเดียว + assert count == 1 + marker IMGOPT1 กันรันซ้ำ + คง CRLF
# วิธีรัน (จากโฟลเดอร์โปรเจกต์): py patch-imgopt1.py

import io, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

# ── 1) helper กลาง ─────────────────────────────────────────────────────────
HELPER_PATH = os.path.join(ROOT, "lib", "imageTools.js")
HELPER = """// lib/imageTools.js — IMGOPT1: บีบอัดรูปฝั่ง client ก่อนอัปโหลด (canvas)
// เป้าหมาย: รูปดิบมือถือ ~3–8MB -> เหลือหลักร้อย KB (ลด ~90%) ยืดอายุ Supabase Free 1GB
// หลักความปลอดภัย: บีบไม่ได้ไม่ว่ากรณีใด -> คืนไฟล์เดิม (อัปโหลดต้องไม่ล้มเพราะตัวบีบ)

async function decodeImage(file) {
  // EXIF orientation: ให้เบราว์เซอร์หมุนรูปให้ถูกตั้งแต่ตอน decode
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {}
    try { return await createImageBitmap(file); } catch {}
  }
  // WebView เก่าไม่มี createImageBitmap: ถอยไปใช้ <img>
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    try { canvas.toBlob((b) => resolve(b), type, quality); } catch { resolve(null); }
  });
}

export async function compressImage(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  try {
    if (!file || !file.type || !file.type.startsWith("image/")) return file;
    if (file.type === "image/gif") return file; // GIF อนิเมชันจะกลายเป็นภาพนิ่ง — ปล่อยผ่านทั้งไฟล์
    const src = await decodeImage(file);
    if (!src) return file;
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
    if (!w0 || !h0) return file;
    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    if (scale >= 1 && file.size <= 300 * 1024) { if (src.close) src.close(); return file; } // เล็กอยู่แล้ว ไม่บีบ
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(src, 0, 0, w, h);
    if (src.close) src.close();
    // ลอง webp ก่อน (ไฟล์เล็กกว่า) — WebView เก่าที่ไม่รองรับจะได้ null/ชนิดอื่น -> ถอยไป jpeg
    let blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob) return file;
    if (blob.size >= file.size) return file; // บีบแล้วใหญ่กว่าเดิม (เจอได้กับ PNG ลายเส้น) -> ใช้ของเดิม
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const name = (file.name || "img").replace(/\\.[^.]+$/, "") + "." + ext;
    try { return new File([blob], name, { type: blob.type }); }
    catch { blob.name = name; return blob; } // WebView เก่าไม่มี File constructor -> แปะ name ให้ Blob แทน
  } catch { return file; }
}
"""

# ── 2) รายการ patch (ไฟล์, anchor เดิม, ข้อความใหม่) ──────────────────────
SELL = os.path.join(ROOT, "app", "sell", "SellClient.js")
FEED = os.path.join(ROOT, "app", "FeedClient.js")

PATCHES = [
    # SellClient: import
    (SELL,
     'import { Camera, ChevronRight, ChevronLeft, X, Search, Plus } from "lucide-react";',
     'import { Camera, ChevronRight, ChevronLeft, X, Search, Plus } from "lucide-react";\r\n'
     'import { compressImage } from "@/lib/imageTools"; // IMGOPT1'),
    # SellClient: บีบก่อนคำนวณ ext
    (SELL,
     '        const ext = (it.file.name.split(".").pop() || "jpg").toLowerCase();',
     '        const up = await compressImage(it.file, { maxEdge: 1600, quality: 0.82 }); // IMGOPT1: มือสองต้องซูมดูสภาพ -> 1600px\r\n'
     '        const ext = (up.name.split(".").pop() || "jpg").toLowerCase();'),
    # SellClient: อัปโหลดตัวที่บีบแล้ว
    (SELL,
     'const { error } = await supabase.storage.from("products").upload(path, it.file, { cacheControl: "3600" });',
     'const { error } = await supabase.storage.from("products").upload(path, up, { cacheControl: "3600", contentType: up.type || "image/jpeg" }); // IMGOPT1'),
    # FeedClient: import
    (FEED,
     'import { createClient } from "@/lib/supabase/client";',
     'import { createClient } from "@/lib/supabase/client";\r\n'
     'import { compressImage } from "@/lib/imageTools"; // IMGOPT1'),
    # FeedClient: บีบก่อนคำนวณ ext
    (FEED,
     '        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();',
     '        const up = await compressImage(file, { maxEdge: 1280, quality: 0.8 }); // IMGOPT1: รูปโพสต์ 1280px พอสำหรับฟีด\r\n'
     '        const ext = (up.name.split(".").pop() || "jpg").toLowerCase();'),
    # FeedClient: อัปโหลดตัวที่บีบแล้ว
    (FEED,
     'const { error } = await supabase.storage.from("products").upload(path, file);',
     'const { error } = await supabase.storage.from("products").upload(path, up, { contentType: up.type || "image/jpeg" }); // IMGOPT1'),
]

def main():
    # กันรันซ้ำ
    for p in (SELL, FEED):
        if "IMGOPT1" in read(p):
            print("SKIP: พบ marker IMGOPT1 ใน", os.path.relpath(p, ROOT), "— เคยรันแล้ว ไม่ทำซ้ำ")
            sys.exit(0)
    if os.path.exists(HELPER_PATH):
        print("SKIP: มี lib/imageTools.js อยู่แล้ว — เคยรันแล้ว ไม่ทำซ้ำ")
        sys.exit(0)

    # ตรวจ anchor ครบก่อนแตะไฟล์จริง (all-or-nothing)
    contents = {}
    for path, old, _new in PATCHES:
        s = contents.get(path) or read(path)
        contents[path] = s
        n = s.count(old)
        assert n == 1, "anchor ไม่เจอหรือเจอซ้ำ (%d): %s" % (n, old[:60])

    # เขียน helper
    write(HELPER_PATH, HELPER.replace("\n", "\r\n"))
    print("OK: สร้าง lib/imageTools.js")

    # แก้ไฟล์
    for path, old, new in PATCHES:
        contents[path] = contents[path].replace(old, new, 1)
    for path, s in contents.items():
        write(path, s)
        print("OK: patch", os.path.relpath(path, ROOT))

    print("DONE: IMGOPT1 ครบ 3 ไฟล์ — ต่อไป: npm run build")

if __name__ == "__main__":
    main()
