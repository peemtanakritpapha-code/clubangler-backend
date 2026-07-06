"use client";
// components/ReturnSteps.js — เส้นขั้นตอนสายคืน 5 ขั้น (component กลาง — ใช้ทั้งหน้ารายละเอียดออเดอร์และหลังบ้านแอดมิน)
// ดีไซน์ v2 ตาม reference: วงแหวนไม่มีเลข · ผ่านแล้ว = เขียวเติม ✓ · ขั้นปัจจุบัน = วงแหวนส้มหนา · ถัดไป = วงแหวนเทา
import { Check } from "lucide-react";

const C = { ink: "#101314", muted: "#8A8F8C", line: "#E5E3DC", ok: "#22C55E", ret: "#EA8C00" };
const STEPS = ["ขอคืน/พิพาท", "แอดมินอนุมัติ", "ผู้ซื้อส่งคืน", "ผู้ขายรับของ", "คืนเงินแล้ว"];
const IDX = { disputed: 0, return_requested: 0, return_approved: 1, return_shipped: 2, return_received: 3, refunded: 4 };

export default function ReturnSteps({ status }) {
  const idx = IDX[status] ?? 0;
  const finished = status === "refunded";
  return (
    <div style={{ display: "flex", padding: "6px 0 2px" }}>
      {STEPS.map((label, i) => {
        const done = i < idx || (i === idx && finished);
        const current = i === idx && !finished;
        return (
          <div key={i} style={{ flex: 1, textAlign: "center", position: "relative", minWidth: 0 }}>
            {i < STEPS.length - 1 && (
              <div style={{ position: "absolute", top: 10, left: "50%", width: "100%", height: 3, background: i < idx ? C.ok : C.line, zIndex: 0, borderRadius: 2 }} />
            )}
            <div style={{
              width: 21, height: 21, borderRadius: "50%", margin: "0 auto", position: "relative", zIndex: 1,
              background: done ? C.ok : "#fff",
              border: done ? `2.5px solid ${C.ok}` : current ? `3.5px solid ${C.ret}` : `3px solid ${C.line}`,
              display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
            }}>
              {done && <Check size={11} color="#fff" strokeWidth={3.5} />}
            </div>
            <div style={{
              fontSize: 10.5, marginTop: 6, lineHeight: 1.35, padding: "0 2px",
              color: current ? C.ret : done ? C.ink : C.muted,
              fontWeight: current ? 800 : done ? 700 : 500,
            }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}
