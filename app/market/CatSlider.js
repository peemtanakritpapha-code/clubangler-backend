"use client";
// app/market/CatSlider.js — REEL-2 (v7): แถบหมวด "สายพานหมุนการ์ด" 15 ใบ
// - v7 เปลี่ยนจาก v6 แค่ชั้นข้อมูล: การ์ดเป็น {label, href, img} 15 ใบ
//   = หมวดหลัก 12 ใบ (ตัด "รอกตกปลา") + การ์ดรอก 3 ใบจาก lib/reelSubs แทรกตำแหน่งเดิม (ช่อง 2-3-4)
//   ⚠️ เลขรูปการ์ดหมวดหลักอิง CAT_MAINS.indexOf เดิมเสมอ — ห้ามอิงตำแหน่งใน list ใหม่ (เลขรูปจะเพี้ยนยกแผง)
// - กลไก v6 คงเดิมทั้งหมด: วิ่งเอง 20px/วิ เท่ากันทุกเครื่อง · ใบพ้นจอซ้ายถูกยกไปต่อท้าย
//   · มือแตะ = หยุดส่งให้ native scroll · ปล่อยสักพักม้วนกลับต้นแล้ววิ่งต่อ · เคารพ prefers-reduced-motion
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CAT_MAINS } from "@/lib/catalog";
import { REEL_CAT, REEL_SUBS } from "@/lib/reelSubs";

const C = { brand: "#0E7E8C", tint: "#E3F1F3", ink: "#101314", line: "#EDF0F0" };

// REEL-2: ประกอบการ์ด 15 ใบครั้งเดียวตอนโหลดโมดูล
const CARDS = (() => {
  const mains = CAT_MAINS.filter((c) => c !== REEL_CAT).map((c) => ({
    label: c,
    href: `/market/${encodeURIComponent(c)}`,
    img: `/cats/cat-${String(CAT_MAINS.indexOf(c) + 1).padStart(2, "0")}.png`,
  }));
  const reels = REEL_SUBS.map((r) => ({
    label: r.label,
    href: `/market/${encodeURIComponent(REEL_CAT)}/${encodeURIComponent(r.slug)}`,
    img: r.img,
  }));
  const at = CAT_MAINS.indexOf(REEL_CAT); // ตำแหน่งเดิมของการ์ดรอกตกปลา
  return [...mains.slice(0, at), ...reels, ...mains.slice(at)];
})();
const N = CARDS.length;
// v7.1: งาน DOM ที่ต้องเสร็จ "ก่อนจอวาด" — บนเซิร์ฟเวอร์ถอยไป useEffect กัน warning
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function CatSlider({ active = "", title = "", auto = false }) {
  const boxRef = useRef(null);   // กรอบเลื่อน (native scroll ของนิ้ว)
  const trackRef = useRef(null); // รางการ์ด (ขยับด้วย transform ตอนวิ่งเอง)
  const pausedRef = useRef(false);
  const [small, setSmall] = useState(true); // มือถือวง 58 / คอม 72
  const [k, setK] = useState(0);            // สายพานหมุนไปแล้วกี่ใบ (ลำดับเริ่มแถว)
  const [arm, setArm] = useState(0);        // ตัวปลุกเครื่องยนต์หลังพัก

  const sz = small ? 58 : 72;
  const STEP = sz + 18 + 4; // กว้างการ์ด + ช่องไฟ

  useEffect(() => {
    const f = () => setSmall(window.innerWidth < 640);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  // ลากด้วยเมาส์ · ล้อเลื่อนแนวตั้ง = เลื่อนแนวนอน · ลากแล้วปล่อยไม่นับเป็นคลิก
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    let down = false, moved = false, sx = 0, sl = 0;
    const md = e => { down = true; moved = false; sx = e.pageX; sl = el.scrollLeft; };
    const mm = e => { if (!down) return; if (Math.abs(e.pageX - sx) > 5) moved = true; el.scrollLeft = sl - (e.pageX - sx); };
    const mu = () => { down = false; };
    const wh = e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } };
    const ck = e => { if (moved) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener("mousedown", md); window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
    el.addEventListener("wheel", wh, { passive: false }); el.addEventListener("click", ck, true);
    return () => {
      el.removeEventListener("mousedown", md); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu);
      el.removeEventListener("wheel", wh); el.removeEventListener("click", ck, true);
    };
  }, []);

  // มือแตะ = สายพานหยุด + ส่งตำแหน่งให้ native scroll แบบไร้กระตุก · ปล่อยแล้วปลุกเครื่องใหม่
  useEffect(() => {
    if (!auto) return;
    const el = boxRef.current, tr = trackRef.current; if (!el || !tr) return;
    let resumeT = null;
    const freeze = () => {
      const m = getComputedStyle(tr).transform;
      let tx = 0;
      if (m && m !== "none") { try { tx = new DOMMatrixReadOnly(m).m41; } catch { tx = 0; } }
      tr.style.transition = "none"; tr.style.transform = "none";
      if (tx < 0) el.scrollLeft = el.scrollLeft - tx; // ภาพเดิมเป๊ะ แค่ย้ายไปอยู่ในมือ native scroll
    };
    const hold = (ms) => { pausedRef.current = true; freeze(); if (resumeT) clearTimeout(resumeT); resumeT = setTimeout(() => { pausedRef.current = false; setArm(a => a + 1); }, ms); };
    const onEnter = () => { pausedRef.current = true; freeze(); if (resumeT) clearTimeout(resumeT); };
    const onLeave = () => hold(1200);
    const onTouch = () => hold(3500);
    el.addEventListener("mouseenter", onEnter); el.addEventListener("mouseleave", onLeave);
    el.addEventListener("touchstart", onTouch, { passive: true }); el.addEventListener("wheel", onTouch, { passive: true });
    return () => {
      if (resumeT) clearTimeout(resumeT);
      el.removeEventListener("mouseenter", onEnter); el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("touchstart", onTouch); el.removeEventListener("wheel", onTouch);
    };
  }, [auto]);

  // เครื่องยนต์สายพาน v7.1: ทุกงานขยับราง/สลับการ์ดเกิด "ก่อนจอวาด" (useLayoutEffect)
  // - ครบ 1 ใบ: setK ใน transitionend → React commit ใหม่ → effect นี้ reset รางก่อน paint = ภาพต่อเนื่องเป๊ะ (แก้กระตุกเดิม)
  // - ผู้ใช้เลื่อนค้าง: ไม่ม้วนกลับหัวแถวแล้ว — ดูดซับใบเต็มเข้า k + หักออกจาก scrollLeft ในเฟรมเดียว → วิ่งต่อจากจุดค้าง
  useIsoLayoutEffect(() => {
    if (!auto) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = boxRef.current, tr = trackRef.current; if (!el || !tr) return;
    if (pausedRef.current) return;
    let cancelled = false;

    // ดูดซับระยะที่ผู้ใช้เลื่อนค้าง (ทำคู่ setK ก่อนจอวาด — ภาพเดิมเป๊ะ ไม่กระโดด)
    const c = Math.floor(el.scrollLeft / STEP);
    if (c > 0) {
      el.scrollLeft = el.scrollLeft - c * STEP;
      setK(v => (v + c) % N); // effect รอบใหม่จะ run ต่อเองจากเศษที่เหลือ
      return;
    }

    const run = () => {
      if (cancelled || pausedRef.current) return;
      tr.style.transition = "none"; tr.style.transform = "translateX(0)";
      void tr.offsetWidth; // บังคับเบราว์เซอร์รับค่าก่อนเริ่มไหล
      tr.style.transition = `transform ${(STEP / 20).toFixed(2)}s linear`;
      tr.style.transform = `translateX(-${STEP}px)`;
    };
    const onEnd = (e) => {
      if (e.propertyName !== "transform" || cancelled || pausedRef.current) return;
      setK(v => (v + 1) % N); // หมุนสายพาน 1 ใบ — effect รอบใหม่ reset รางก่อนจอวาด
    };
    tr.addEventListener("transitionend", onEnd);
    run();

    return () => {
      cancelled = true;
      tr.removeEventListener("transitionend", onEnd);
    };
  }, [auto, k, arm, STEP]);

  // เปิดหน้าหมวด (ไม่ auto) = เลื่อนให้วงหมวดนั้นโผล่พอดีตา
  useEffect(() => {
    const el = boxRef.current; if (!el || !active || auto) return;
    const it = el.querySelector("[data-active='1']");
    if (it) el.scrollLeft = Math.max(0, it.offsetLeft - 24);
  }, [active, auto]);

  const LIST = auto ? [...CARDS.slice(k), ...CARDS.slice(0, k)] : CARDS;
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {title ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px 8px", fontSize: small ? 13.5 : 15, fontWeight: 800, color: C.ink }}>
          <span style={{ width: 4, height: 16, background: C.brand, borderRadius: 2 }} />{title}
        </div>
      ) : null}
      <div ref={boxRef} className="cat-slider" style={{ overflowX: "auto", padding: "6px 10px 10px", cursor: "grab", WebkitOverflowScrolling: "touch" }}>
        <div ref={trackRef} style={{ display: "flex", gap: 4, width: "max-content" }}>
          {LIST.map((it) => {
            const on = it.label === active;
            return (
              <Link key={it.label} href={it.href} data-active={on ? "1" : "0"} draggable={false}
                style={{ flex: "none", width: sz + 18, textDecoration: "none", textAlign: "center", color: on ? C.brand : C.ink }}>
                <img src={it.img} alt={it.label} loading="lazy" draggable={false}
                  style={{ width: sz, height: sz, borderRadius: "50%", background: on ? C.tint : "#fff", border: on ? `2px solid ${C.brand}` : `1px solid ${C.line}`, objectFit: "cover", display: "block", margin: "0 auto", boxSizing: "border-box" }} />
                <div style={{ fontSize: small ? 10.5 : 11.5, fontWeight: on ? 800 : 600, marginTop: 4, lineHeight: 1.25 }}>{it.label}</div>
              </Link>
            );
          })}
        </div>
      </div>
      <style>{`.cat-slider::-webkit-scrollbar{display:none}.cat-slider{scrollbar-width:none}`}</style>
    </div>
  );
}
