// lib/imageTools.js — IMGOPT1: บีบอัดรูปฝั่ง client ก่อนอัปโหลด (canvas)
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
    const name = (file.name || "img").replace(/\.[^.]+$/, "") + "." + ext;
    try { return new File([blob], name, { type: blob.type }); }
    catch { blob.name = name; return blob; } // WebView เก่าไม่มี File constructor -> แปะ name ให้ Blob แทน
  } catch { return file; }
}
