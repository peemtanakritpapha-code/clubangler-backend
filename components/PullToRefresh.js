"use client";
// components/PullToRefresh.js — PTR1: ปัดหน้าจอลงเพื่อรีเฟรช
// เปิดเฉพาะในแอพ Capacitor / PWA standalone เท่านั้น (เบราว์เซอร์ปกติ Chrome มี pull-to-refresh ของตัวเองอยู่แล้ว — เปิดซ้อนจะตีกัน)
// หลักการ: หน้าต้องอยู่บนสุด (scrollY = 0) → ลากนิ้วลงเกิน 70px → วงหมุนแบรนด์ → reload ทั้งหน้า (ได้ข้อมูลสดตาม Iron Rule 10)
import { useEffect, useRef, useState } from "react";

const BRAND = "#0E7E8C";
const TINT = "#E7F2F3";
const THRESH = 70;   // ระยะปล่อยแล้วรีเฟรช
const MAX = 110;     // ลากได้ไกลสุด

export default function PullToRefresh() {
  const [enabled, setEnabled] = useState(false); // ตัดสินใจใน useEffect เท่านั้น → SSR render แรกว่างเสมอ (deterministic)
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef(null);
  const active = useRef(false);

  useEffect(() => {
    const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    const isStandalone = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    setEnabled(isCapacitor || isStandalone);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onStart = e => {
      if (busy || window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    };
    const onMove = e => {
      if (!active.current || startY.current == null) return;
      if (window.scrollY > 0) { active.current = false; setPull(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      setPull(dy > 0 ? Math.min(dy * 0.5, MAX) : 0); // หน่วงครึ่งหนึ่งให้ฟีลยางยืด
    };
    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      setPull(p => {
        if (p >= THRESH) {
          setBusy(true);
          setTimeout(() => window.location.reload(), 180);
          return THRESH;
        }
        return 0;
      });
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, busy]);

  if (!enabled || (pull <= 0 && !busy)) return null;
  const show = busy ? THRESH : pull;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 80, display: "flex", justifyContent: "center", pointerEvents: "none", transform: `translateY(${show - 46}px)`, transition: active.current ? "none" : "transform .18s ease" }}>
      <style>{`@keyframes caPtrSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,.18)", display: "grid", placeItems: "center", opacity: Math.min(show / THRESH, 1) }}>
        <div style={{ width: 20, height: 20, borderRadius: 999, border: `3px solid ${TINT}`, borderTopColor: BRAND, transform: busy ? "none" : `rotate(${show * 3.4}deg)`, animation: busy ? "caPtrSpin .7s linear infinite" : "none" }} />
      </div>
    </div>
  );
}
