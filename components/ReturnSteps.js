"use client";
// components/ReturnSteps.js — timeline สายคืน 5 ขั้น (ใช้ร่วมทุกจอ ห้ามสร้างซ้ำ)
import { RETURN_STEP_IDX } from "@/lib/orderMeta";

const C = { brand: "#C2410C", line: "#E5E9EA", muted: "#6B7678" };
const LABELS = ["ขอคืน/พิพาท", "แอดมินอนุมัติ", "ส่งคืน+track", "ผู้ขายรับของ", "คืนเงินแล้ว"];

export default function ReturnSteps({ status }) {
  const idx = RETURN_STEP_IDX[status];
  if (idx == null) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 2, margin: "8px 0" }}>
      {LABELS.map((s, i) => (
        <div key={s} style={{ flex: 1, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: i <= idx ? C.brand : C.line }} />}
            <div style={{ width: 10, height: 10, borderRadius: 99, background: i <= idx ? C.brand : "#fff", border: `2px solid ${i <= idx ? C.brand : C.line}`, flexShrink: 0 }} />
            {i < LABELS.length - 1 && <div style={{ flex: 1, height: 2, background: i < idx ? C.brand : C.line }} />}
          </div>
          <div style={{ fontSize: 9, color: i <= idx ? C.brand : C.muted, marginTop: 3, fontWeight: i === idx ? 800 : 400 }}>{i + 1}. {s}</div>
        </div>
      ))}
    </div>
  );
}
