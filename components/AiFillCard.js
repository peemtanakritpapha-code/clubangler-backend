"use client";
// components/AiFillCard.js — AI1: ปุ่ม "ให้ AI ช่วยกรอกจากรูป" ใต้ช่องรูปภาพในหน้าลงขาย
// ทำงานเฉพาะรูปใหม่ (k === "new") — ส่ง base64 ≤5 รูปแรกเข้า /api/ai/draft-listing
// AI ไม่แตะ สภาพ/เกรด/ตำหนิ/ราคา — component นี้แค่ส่ง draft กลับผ่าน onDraft ให้หน้า sell ตัดสินใจเติม
import { useState } from "react";
import { Sparkles, UserRound } from "lucide-react";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", warnBg: "#FCF3E3", warnInk: "#8A5A12", warnLine: "#EBCF9C" };

// ย่อรูปฝั่งเครื่องผู้ใช้ก่อนส่ง (ด้านยาวสุด 1280px, JPEG 82%) — จาก ~4MB เหลือ ~200-400KB
// เหตุผล: body ก้อนใหญ่โดนปลายทางตัดกลางทาง + AI ย่อรูปเองอยู่แล้ว ส่งใหญ่ไปเปลืองเปล่า
// ถ้า decode ไม่ได้ (ไฟล์แปลก) fallback ส่งไฟล์เดิมตามชนิดจริง
const fileToB64 = (file, maxSide = 1280, quality = 0.82) => new Promise((res, rej) => {
  const raw = () => {
    const r = new FileReader();
    r.onload = () => res({ data: r.result.split(",")[1], media_type: file.type || "image/jpeg" });
    r.onerror = () => rej(new Error("อ่านไฟล์ไม่สำเร็จ"));
    r.readAsDataURL(file);
  };
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      res({ data: cv.toDataURL("image/jpeg", quality).split(",")[1], media_type: "image/jpeg" });
    } catch { raw(); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); raw(); };
  img.src = url;
});

export default function AiFillCard({ imgs, onDraft }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null); // { filled: string[], skipped: string[] }
  const [note, setNote] = useState(""); // AI2: โน้ต/ข้อสังเกตจาก AI เช่น "ไม่แน่ใจว่ารูปเป็นสินค้าชิ้นเดียวกัน"
  const newImgs = imgs.filter(it => it.k === "new");

  const run = async () => {
    if (!newImgs.length || busy) return;
    setBusy(true); setErr(""); setDone(null); setNote("");
    try {
      const images = [];
      for (const it of newImgs.slice(0, 5)) {
        images.push(await fileToB64(it.file));   // ได้ { data, media_type } จากตัวย่อรูป
      }
      const resp = await fetch("/api/ai/draft-listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "เกิดข้อผิดพลาด");
      const summary = onDraft(data.draft); // หน้า sell เติมเฉพาะช่องว่าง แล้วส่งสรุปกลับมา
      setDone(summary || { filled: [], skipped: [] });
      setNote(data.draft?.note || "");
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    }
    setBusy(false);
  };

  return (
    <div style={{ border: `1.5px solid ${C.brandTint}`, background: "#F7FBFC", borderRadius: 14, padding: "12px 14px", margin: "12px 0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={run} disabled={!newImgs.length || busy}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px",
            border: "none", borderRadius: 999, background: !newImgs.length || busy ? "#B9D6DB" : C.brand,
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: !newImgs.length || busy ? "default" : "pointer",
            fontFamily: "inherit",
          }}>
          <Sparkles size={15} />
          {busy ? `AI กำลังอ่านรูป (${Math.min(newImgs.length, 5)} รูป)...` : "ให้ AI ช่วยกรอกจากรูป"}
        </button>
        <span style={{ fontSize: 11.5, color: C.muted }}>
          {newImgs.length ? "AI จะเติมเฉพาะช่องที่ยังว่าง — ตรวจก่อนโพสต์เสมอ" : "เพิ่มรูปสินค้าก่อน แล้วปุ่มนี้จะใช้งานได้"}
        </span>
      </div>

      {err && <div style={{ marginTop: 8, fontSize: 12, color: "#C0392B" }}>{err}</div>}

      {done && (
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {done.filled.length > 0 && (
            <div style={{ fontSize: 12, color: C.brand }}>
              ✓ AI เติมให้: {done.filled.join(" · ")}
            </div>
          )}
          {done.skipped.length > 0 && (
            <div style={{ fontSize: 12, color: C.muted }}>
              เว้นไว้ (มีข้อมูลอยู่แล้ว/AI ไม่มั่นใจ): {done.skipped.join(" · ")}
            </div>
          )}
          {note && (
            <div style={{ fontSize: 12, color: C.warnInk, background: C.warnBg, border: `1px solid ${C.warnLine}`, borderRadius: 10, padding: "8px 12px" }}>
              💬 ข้อสังเกตจาก AI: {note}
            </div>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700,
            background: C.warnBg, border: `1px solid ${C.warnLine}`, color: C.warnInk,
            borderRadius: 10, padding: "8px 12px",
          }}>
            <UserRound size={14} />
            สภาพสินค้า / เกรด / ตำหนิ — ผู้ขายเป็นคนกำหนดเอง AI ไม่กรอกส่วนนี้
          </div>
        </div>
      )}
    </div>
  );
}
