"use client";
// app/market/CatSlider.js — SEO-5e(v4): แถบหมวดสายพานไร้ขอบ
// - วนลูปเนียนทั้ง "วิ่งเอง" และ "นิ้วปัด/ล้อเมาส์" — ผู้ใช้ไม่มีวันชนจุดสิ้นสุด (wrap สองทิศบน scroll event:
//   ภาพที่ตำแหน่ง x กับ x+ความกว้างหนึ่งชุด เหมือนกันเป๊ะ การย้ายตำแหน่งจึงมองไม่เห็น)
// - ความเร็ววิ่งอิงเวลา 20px/วิ เท่ากันทุกเครื่อง (ไม่อิงเฟรมเรต · เก็บทศนิยมเอง กัน WebView ปัดเศษ)
// - จอกว้างจนเห็นครบทุกหมวด = โชว์ชุดเดียว ไม่วน ไม่วิ่ง (ไม่มีอะไรให้เลื่อน)
// ใช้ 2 ที่: /market (auto + หัวข้อ) และหน้าอื่นที่อยากได้แถบหมวด (active = ไฮไลต์หมวด)
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CAT_MAINS } from "@/lib/catalog";

const C = { brand: "#0E7E8C", tint: "#E3F1F3", ink: "#101314", line: "#EDF0F0" };

export default function CatSlider({ active = "", title = "", auto = false }) {
  const ref = useRef(null);
  const [small, setSmall] = useState(true); // มือถือวง 58 / คอม 72
  const [loop, setLoop] = useState(false);  // ต้องวนไหม (จอแคบกว่าหนึ่งชุด)

  const sz = small ? 58 : 72;
  const ITEM_W = sz + 18, GAP = 4;
  const oneSetW = CAT_MAINS.length * ITEM_W + (CAT_MAINS.length - 1) * GAP;

  useEffect(() => {
    const f = () => {
      setSmall(window.innerWidth < 640);
      const el = ref.current;
      if (el) setLoop(el.clientWidth < oneSetW - 8);
    };
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [oneSetW]);

  // สายพานไร้ขอบ: ตั้งต้นกลางราง + วาร์ปสองทิศทุกครั้งที่เลื่อน (นิ้ว/ล้อ/วิ่งเอง)
  useEffect(() => {
    const el = ref.current; if (!el || !loop) return;
    const half = () => el.scrollWidth / 2;
    el.scrollLeft = half(); // เริ่มกลางราง มีที่ให้ปัดถอยหลังเสมอ
    const wrap = () => {
      const h = half(); if (h <= 0) return;
      if (el.scrollLeft >= h + h / 2) el.scrollLeft -= h;      // ไปหน้าจนลึกชุดสอง = ดึงกลับ
      else if (el.scrollLeft < h / 2) el.scrollLeft += h;      // ถอยหลังจนลึกชุดแรก = ส่งไปหน้า
    };
    el.addEventListener("scroll", wrap, { passive: true });
    return () => el.removeEventListener("scroll", wrap);
  }, [loop]);

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

  // วิ่งเองช้าๆ (เฉพาะตอนต้องวน) — แตะ/ลาก/ชี้เมาส์ = หยุด ปล่อยสักพักวิ่งต่อจากจุดเดิม
  useEffect(() => {
    if (!auto || !loop) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current; if (!el) return;
    const SPEED = 20;
    let raf, resumeT = null, paused = false, pos = el.scrollLeft, last = null;
    const step = (t) => {
      if (last === null) last = t;
      const dt = Math.min((t - last) / 1000, 0.1); last = t;
      if (!paused) { pos += SPEED * dt; el.scrollLeft = pos; pos = el.scrollLeft; } // ให้ wrap ปรับแล้วรับค่ากลับ
      else pos = el.scrollLeft;
      raf = requestAnimationFrame(step);
    };
    const hold = (ms) => { paused = true; if (resumeT) clearTimeout(resumeT); resumeT = setTimeout(() => { paused = false; }, ms); };
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
  }, [auto, loop]);

  // เปิดหน้าหมวด = เลื่อนให้วงหมวดนั้นโผล่พอดีตา
  useEffect(() => {
    const el = ref.current; if (!el || !active || loop) return;
    const it = el.querySelector("[data-active='1']");
    if (it) el.scrollLeft = Math.max(0, it.offsetLeft - 24);
  }, [active, loop]);

  const LIST = loop ? [...CAT_MAINS, ...CAT_MAINS] : CAT_MAINS;
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {title ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px 8px", fontSize: small ? 13.5 : 15, fontWeight: 800, color: C.ink }}>
          <span style={{ width: 4, height: 16, background: C.brand, borderRadius: 2 }} />{title}
        </div>
      ) : null}
      <div ref={ref} className="cat-slider" style={{ display: "flex", gap: GAP, overflowX: "auto", padding: "6px 10px 10px", cursor: "grab", WebkitOverflowScrolling: "touch" }}>
        {LIST.map((cat, idx) => {
          const i = idx % CAT_MAINS.length;
          const on = cat === active;
          return (
            <Link key={`${cat}-${idx}`} href={`/market/${encodeURIComponent(cat)}`} data-active={on ? "1" : "0"} draggable={false}
              style={{ flex: "none", width: ITEM_W, textDecoration: "none", textAlign: "center", color: on ? C.brand : C.ink }}>
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
