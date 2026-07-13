"use client";
// app/market/CatSlider.js — SEO-5c: แถบหมวดแบบสไลด์แถวเดียว (มือถือปัด / คอมลากเมาส์+ล้อเลื่อน)
// ใช้ 2 ที่: /market (ใต้ช่องค้นหา, มีหัวข้อ) และ /market/[cat] (บนสุด, ไฮไลต์หมวดที่เปิดอยู่)
// รูปหมวด: public/cats/cat-01..13.png เรียงตามลำดับ CAT_MAINS
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CAT_MAINS } from "@/lib/catalog";

const C = { brand: "#0E7E8C", tint: "#E3F1F3", ink: "#101314", line: "#EDF0F0" };

export default function CatSlider({ active = "", title = "" }) {
  const ref = useRef(null);
  const [small, setSmall] = useState(true); // มือถือวง 58 / คอม 72

  useEffect(() => {
    const f = () => setSmall(window.innerWidth < 640);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  // ลากด้วยเมาส์ + ล้อเลื่อนแนวตั้ง = เลื่อนแนวนอน · ลากแล้วปล่อย ไม่นับเป็นคลิกลิงก์
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
