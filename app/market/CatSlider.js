"use client";
// app/market/CatSlider.js — SEO-5e(v5): แถบหมวดการ์ดชุดเดียว
// - ข้อมูลชุดเดียว 13 หมวด · ปัดเลื่อนปกติ มีต้น-ปลาย
// - โหมดวิ่งเอง (auto): เลื่อนช้า 20px/วิ เท่ากันทุกเครื่อง (อิงเวลา ไม่อิงเฟรมเรต · เก็บทศนิยมเอง กัน WebView ปัดเศษ)
//   ถึงปลายสุด → พักครู่ → ม้วนกลับต้นแบบสมูท → พัก → วิ่งรอบใหม่
// - แตะ/ลาก/ชี้เมาส์ = หยุด ปล่อยสักพักวิ่งต่อจากจุดเดิม
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CAT_MAINS } from "@/lib/catalog";

const C = { brand: "#0E7E8C", tint: "#E3F1F3", ink: "#101314", line: "#EDF0F0" };

export default function CatSlider({ active = "", title = "", auto = false }) {
  const ref = useRef(null);
  const [small, setSmall] = useState(true); // มือถือวง 58 / คอม 72

  useEffect(() => {
    const f = () => setSmall(window.innerWidth < 640);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  // ลากด้วยเมาส์ · ล้อเลื่อนแนวตั้ง = เลื่อนแนวนอน · ลากแล้วปล่อยไม่นับเป็นคลิก
  useEffect(() => {
    const el = ref.current; if (!el) return;
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

  // วิ่งเอง: run → ถึงปลาย rest → ม้วนกลับสมูท rewind → rest → run
  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current; if (!el) return;
    const SPEED = 20, REST_MS = 900;
    let raf, resumeT = null, paused = false, mode = "run", waitUntil = 0;
    let pos = el.scrollLeft, last = null;
    const maxX = () => Math.max(0, el.scrollWidth - el.clientWidth);
    const step = (t) => {
      if (last === null) last = t;
      const dt = Math.min((t - last) / 1000, 0.1); last = t;
      if (paused) { pos = el.scrollLeft; }
      else if (mode === "run") {
        pos = Math.min(pos + SPEED * dt, maxX());
        el.scrollLeft = pos;
        if (pos >= maxX() - 0.5) { mode = "rest"; waitUntil = t + REST_MS; }
      } else if (mode === "rest") {
        if (t >= waitUntil) { mode = "rewind"; el.scrollTo({ left: 0, behavior: "smooth" }); }
      } else if (mode === "rewind") {
        if (el.scrollLeft <= 1) { pos = 0; mode = "rest2"; waitUntil = t + REST_MS; }
      } else if (mode === "rest2") {
        if (t >= waitUntil) { mode = "run"; pos = el.scrollLeft; }
      }
      raf = requestAnimationFrame(step);
    };
    const hold = (ms) => { paused = true; mode = "run"; if (resumeT) clearTimeout(resumeT); resumeT = setTimeout(() => { paused = false; }, ms); };
    const onEnter = () => { paused = true; if (resumeT) clearTimeout(resumeT); };
    const onLeave = () => hold(1200);
    const onTouch = () => hold(3500);
    el.addEventListener("mouseenter", onEnter); el.addEventListener("mouseleave", onLeave);
    el.addEventListener("touchstart", onTouch, { passive: true }); el.addEventListener("wheel", onTouch, { passive: true });
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf); if (resumeT) clearTimeout(resumeT);
      el.removeEventListener("mouseenter", onEnter); el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("touchstart", onTouch); el.removeEventListener("wheel", onTouch);
    };
  }, [auto]);

  // เปิดหน้าหมวด = เลื่อนให้วงหมวดนั้นโผล่พอดีตา
  useEffect(() => {
    const el = ref.current; if (!el || !active) return;
    const it = el.querySelector("[data-active='1']");
    if (it) el.scrollLeft = Math.max(0, it.offsetLeft - 24);
  }, [active]);

  const sz = small ? 58 : 72;
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {title ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px 8px", fontSize: small ? 13.5 : 15, fontWeight: 800, color: C.ink }}>
          <span style={{ width: 4, height: 16, background: C.brand, borderRadius: 2 }} />{title}
        </div>
      ) : null}
      <div ref={ref} className="cat-slider" style={{ display: "flex", gap: 4, overflowX: "auto", padding: "6px 10px 10px", cursor: "grab", WebkitOverflowScrolling: "touch" }}>
        {CAT_MAINS.map((cat, i) => {
          const on = cat === active;
          return (
            <Link key={cat} href={`/market/${encodeURIComponent(cat)}`} data-active={on ? "1" : "0"} draggable={false}
              style={{ flex: "none", width: sz + 18, textDecoration: "none", textAlign: "center", color: on ? C.brand : C.ink }}>
              <img src={`/cats/cat-${String(i + 1).padStart(2, "0")}.png`} alt={cat} loading="lazy" draggable={false}
                style={{ width: sz, height: sz, borderRadius: "50%", background: on ? C.tint : "#fff", border: on ? `2px solid ${C.brand}` : `1px solid ${C.line}`, objectFit: "cover", display: "block", margin: "0 auto", boxSizing: "border-box" }} />
              <div style={{ fontSize: small ? 10.5 : 11.5, fontWeight: on ? 800 : 600, marginTop: 4, lineHeight: 1.25 }}>{cat}</div>
            </Link>
          );
        })}
      </div>
      <style>{`.cat-slider::-webkit-scrollbar{display:none}.cat-slider{scrollbar-width:none}`}</style>
    </div>
  );
}
