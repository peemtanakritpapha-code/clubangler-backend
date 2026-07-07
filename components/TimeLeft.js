"use client";
// components/TimeLeft.js — ตัวบอกเวลาที่เหลือก่อนถึงกำหนด (component กลาง — ห้ามสร้างซ้ำ)
// หลักการ: ความละเอียดปรับตามเวลาที่เหลือ — หลายวันบอกเป็นวัน / ไม่ถึงวันบอกชั่วโมง / ไม่ถึงชั่วโมงบอกนาที
// สี: ปกติเทา → เหลือ <24 ชม. ส้ม → เหลือ <1 ชม. แดง (ไม่กะพริบ ไม่เร่งเร้า)
// เลยกำหนดแล้ว: ไม่โชว์ตัวเลขติดลบ — บอกว่าระบบกำลังดำเนินการ (cron วิ่งทุก 30 นาที)
import { useEffect, useState } from "react";

const MUTED = "#6B7678", AMBER = "#B7791F", DANGER = "#C0392B";

// startIso + ชั่วโมง → ข้อความเวลาที่เหลือ (null = เลยกำหนดแล้ว)
function remain(deadlineMs, now) {
  const diff = deadlineMs - now;
  if (diff <= 0) return null;
  const m = Math.ceil(diff / 60000);
  if (m < 60) return { text: `${m} นาที`, tone: DANGER };
  const h = Math.floor(m / 60);
  if (h < 24) return { text: `${h} ชม. ${m % 60} นาที`, tone: AMBER };
  const d = Math.floor(h / 24);
  const when = new Date(deadlineMs).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  return { text: `${d} วัน (ภายใน ${when})`, tone: MUTED };
}

export default function TimeLeft({ startIso, minutes = 0, hours = 0, days = 0, prefix = "เหลืออีก", overdueText = "เลยกำหนดแล้ว — ระบบกำลังดำเนินการ", style = {} }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000); // อัปเดตทุกนาที — ไม่วิ่งเป็นวินาที
    return () => clearInterval(t);
  }, []);
  if (!startIso) return null;
  const deadline = new Date(startIso).getTime() + (days * 24 + hours) * 3600000 + minutes * 60000;
  const r = remain(deadline, now);
  return (
    <span style={{ fontWeight: 700, color: r ? r.tone : MUTED, ...style }}>
      {r ? `${prefix} ${r.text}` : overdueText}
    </span>
  );
}
