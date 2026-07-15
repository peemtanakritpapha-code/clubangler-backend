// components/ConsentBuyModal.js — CONSENT-1: popup จุดที่ 2 ยอมรับกติกาก่อนยืนยันสั่งซื้อ
// เลขวันดึงจาก platform_config (auto_confirm_days) — แอดมินแก้ได้ ข้อความเปลี่ยนตาม
"use client";
import Link from "next/link";

const C = { brand: "#0E7E8C", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", danger: "#C0392B" };

export default function ConsentBuyModal({ open, days, busy, onAccept, onClose }) {
  if (!open) return null;
  const rows = [
    ["📹", <>ถ่ายวิดีโอตอนแกะพัสดุทุกครั้ง <b>เริ่มถ่ายตั้งแต่ยังไม่แกะ ให้เห็นสภาพกล่องรอบด้าน</b> — เป็นหลักฐานบังคับหากต้องเปิดเคส &quot;ของไม่ตรงปก&quot;</>],
    ["⏱", <>ตรวจสินค้าและแจ้งปัญหา<b>ก่อนกดยืนยันรับ</b> — หากไม่กดใดๆ ระบบจะยืนยันแทนภายใน {days} วันหลังจัดส่ง แล้วโอนเงินให้ผู้ขาย</>],
    ["↩️", <>สินค้ามือสองซื้อขายขาด <b>ไม่รับคืนกรณีเปลี่ยนใจ</b></>],
    ["💰", <>กรณีได้รับอนุมัติให้คืนสินค้า <b>ผู้ซื้อเป็นผู้ชำระค่าจัดส่งคืน</b></>],
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.55)", zIndex: 1000, display: "grid", placeItems: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 12 }}>ก่อนสั่งซื้อ อ่านสักนิด 🎣</div>
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(([ic, tx], i) => (
            <div key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, color: C.ink, lineHeight: 1.65 }}>
              <span style={{ flexShrink: 0 }}>{ic}</span><span>{tx}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} disabled={busy} style={{ flex: 1, height: 42, border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={onAccept} disabled={busy} style={{ flex: 2, height: 42, border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", opacity: busy ? .6 : 1 }}>{busy ? "กำลังดำเนินการ..." : "ยอมรับและสั่งซื้อ"}</button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: "center" }}>การกดยอมรับถูกบันทึกเวลาไว้ ใช้อ้างอิงกรณีพิพาท · <Link href="/terms" style={{ color: C.brand, fontWeight: 700 }}>อ่านกติกาฉบับเต็ม</Link></div>
      </div>
    </div>
  );
}
