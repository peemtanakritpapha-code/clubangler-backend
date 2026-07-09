"use client";
// components/ReportModal.js — POST2: modal รายงานเนื้อหา (ใช้ร่วม โพสต์/คอมเมนต์/สินค้า)
// กติกา (Iron Rule 3): รายงานผ่าน modal มีเหตุผลเสมอ — ห้าม window.prompt/alert
// ส่งเข้า /api/reports (service key) — ห้าม insert ตาราง reports ตรงจาก client
import { useState } from "react";

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC", bg: "#F6F5F2", danger: "#C24D42" };

export const REPORT_REASONS = [
  "สแปม / หลอกลวง / ชวนซื้อขายนอกระบบ",
  "สินค้าต้องห้าม / ผิดกฎหมาย",
  "เนื้อหาไม่เหมาะสม / ก้าวร้าว",
  "ของปลอม / ละเมิดลิขสิทธิ์",
  "อื่นๆ",
];

// props: open, onClose, targetType ('post'|'comment'|'product'), targetId, targetLabel (ข้อความบอกว่ารายงานอะไร)
export default function ReportModal({ open, onClose, targetType, targetId, targetLabel }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const close = () => { setReason(""); setDetail(""); setErr(""); setDone(false); onClose(); };

  const submit = async () => {
    if (!reason) { setErr("กรุณาเลือกเหตุผล"); return; }
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, detail: detail.trim() }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "ส่งรายงานไม่สำเร็จ"); setBusy(false); return; }
      setDone(true);
    } catch {
      setErr("ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    setBusy(false);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) close(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 90 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400 }}>
        {done ? (
          <>
            <b style={{ fontSize: 15, color: C.ink }}>✅ ได้รับรายงานแล้ว</b>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.7 }}>
              ขอบคุณที่ช่วยดูแลชุมชน ทีมงานจะตรวจสอบโดยเร็วที่สุด
            </div>
            <button onClick={close}
              style={{ width: "100%", marginTop: 14, border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: C.brand, color: "#fff" }}>
              ปิด
            </button>
          </>
        ) : (
          <>
            <b style={{ fontSize: 15, color: C.ink }}>🚩 รายงาน</b>
            {targetLabel && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{targetLabel}</div>}
            <div style={{ marginTop: 4 }}>
              {REPORT_REASONS.map(r => (
                <label key={r} onClick={() => setReason(r)}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", border: `1.5px solid ${reason === r ? C.brand : C.line}`, background: reason === r ? C.brandTint : "#fff", borderRadius: 11, marginTop: 8, cursor: "pointer", fontSize: 13, color: C.ink }}>
                  <input type="radio" checked={reason === r} onChange={() => setReason(r)} style={{ marginTop: 3, accentColor: C.brand }} />
                  {r}
                </label>
              ))}
            </div>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} maxLength={1000}
              placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
              style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "10px 12px", fontSize: 13, marginTop: 10, resize: "vertical", minHeight: 64, outline: "none", fontFamily: "inherit" }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
              ทีมงานจะตรวจสอบโดยเร็วที่สุด · การรายงานเป็นความลับ อีกฝ่ายไม่เห็นว่าใครรายงาน
            </div>
            {err && <div style={{ fontSize: 12, color: C.danger, marginTop: 8, fontWeight: 600 }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={close} disabled={busy}
                style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: C.bg, color: C.ink }}>
                ยกเลิก
              </button>
              <button onClick={submit} disabled={busy}
                style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: C.danger, color: "#fff", opacity: busy ? 0.7 : 1 }}>
                {busy ? "กำลังส่ง..." : "ส่งรายงาน"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
