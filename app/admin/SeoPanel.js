"use client";
// app/admin/SeoPanel.js — SEO-4: แผงแก้ title/description/ย่อหน้าแนะนำ ของหน้าสำคัญ (แท็บ ?tab=seo)
// ตาม mock-seo-panel ที่เคาะ 13 ก.ค.: แถบเลือกหน้า + ตัวนับอักษรแถบสี + พรีวิวแบบผลค้นหา Google (ไม่มีปุ่ม AI)
// ข้อมูลโหลด/บันทึกผ่าน /api/admin/seo-pages · ค่าที่ seed ไว้จาก SQL โผล่ที่นี่ แก้ได้เสมอ
import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { CAT_MAINS } from "@/lib/catalog";
import { REEL_CAT, REEL_SUBS } from "@/lib/reelSubs"; // REEL-3

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC", bg: "#F6F5F2", ok: "#0E7E5C", warn: "#B8790A", danger: "#C24D42" };

// รายการหน้า: home, market + ทุกหมวดหลัก
const PAGE_DEFS = [
  { key: "home", name: "หน้าแรก", url: "" },
  { key: "market", name: "ตลาด", url: "/market" },
  ...CAT_MAINS.map(c => ({ key: `cat:${c}`, name: c, url: `/market/${c}` })),
  ...REEL_SUBS.map(r => ({ key: `sub:${REEL_CAT}/${r.slug}`, name: r.label, url: `/market/${REEL_CAT}/${r.slug}` })), // REEL-3: หน้าหมวดย่อยรอก
];

function Counter({ n, ok, warn }) {
  const cls = n <= ok ? { background: "#E7F6EC", color: "#1E7B43" } : n <= warn ? { background: "#FFF4DE", color: C.warn } : { background: "#FDEBEB", color: C.danger };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 999, ...cls }}>{n}/{ok}</span>;
}

function SerpPreview({ title, description, url }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginTop: 14, background: "#fff", fontFamily: "arial, sans-serif" }}>
      <div style={{ fontFamily: "inherit", fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 8 }}>🔍 พรีวิวบน Google (อัปเดตสดตามที่พิมพ์)</div>
      <div style={{ color: "#202124", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: C.brandTint, color: C.brand, fontSize: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>CA</span>
        clubangler.com{url}
      </div>
      <div style={{ color: "#1a0dab", fontSize: 19, lineHeight: 1.3, margin: "3px 0 2px" }}>
        {title?.length > 60 ? title.slice(0, 60) + "…" : title || "(ยังไม่ตั้ง)"}
      </div>
      <div style={{ color: "#4d5156", fontSize: 13.5, lineHeight: 1.5 }}>
        {description?.length > 155 ? description.slice(0, 155) + "…" : description || "(ยังไม่ตั้ง)"}
      </div>
    </div>
  );
}

export default function SeoPanel({ onError }) {
  const [rows, setRows] = useState({});      // page_key → แถวจาก DB
  const [cur, setCur] = useState(PAGE_DEFS[0]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [intro, setIntro] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/seo-pages");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดไม่สำเร็จ");
      setRows(Object.fromEntries((data.pages || []).map(p => [p.page_key, p])));
    } catch (e) { onError?.(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // สลับหน้า = เติมค่าจาก DB ลงฟอร์ม
  useEffect(() => {
    const r = rows[cur.key] || {};
    setTitle(r.title || ""); setDesc(r.description || ""); setIntro(r.intro_html || ""); setSaved(false);
  }, [cur, rows]);

  const save = async () => {
    setBusy(true); setSaved(false);
    try {
      const res = await fetch("/api/admin/seo-pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_key: cur.key, title, description: desc, intro_html: intro }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setRows(prev => ({ ...prev, [cur.key]: { ...prev[cur.key], page_key: cur.key, title, description: desc, intro_html: intro } }));
      setSaved(true);
    } catch (e) { onError?.(e.message); }
    setBusy(false);
  };

  const isCat = cur.key.startsWith("cat:") || cur.key.startsWith("sub:"); // REEL-3b: หน้าหมวดย่อยรอกก็มีย่อหน้าแนะนำ
  const inp = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 13, outlineColor: C.brand, boxSizing: "border-box", background: "#fff" };
  const lbl = { fontSize: 12.5, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "14px 0 5px" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Globe size={17} color={C.brand} />
        <span style={{ fontSize: 15, fontWeight: 800 }}>SEO หน้าเว็บ</span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
        แก้ชื่อและคำอธิบายที่โชว์บน Google · จุดเขียว = ตั้งค่าแล้ว · ค่าเริ่มต้นมาจากชุดที่วิเคราะห์คำค้นจริง (13 ก.ค.)
      </div>

      {/* แถบเลือกหน้า */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {PAGE_DEFS.map(p => {
          const on = p.key === cur.key, has = !!rows[p.key]?.title;
          return (
            <button key={p.key} onClick={() => setCur(p)} style={{
              font: "inherit", fontSize: 12, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
              border: `1px solid ${on ? C.brand : C.line}`, background: on ? C.brand : "#fff",
              color: on ? "#fff" : C.ink, fontWeight: on ? 700 : 500, display: "flex", alignItems: "center", gap: 5,
            }}>
              {p.name}
              {has && <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? "#fff" : "#2BAF66" }} />}
            </button>
          );
        })}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 }}>
        {loading ? <div style={{ fontSize: 13, color: C.muted, padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
          <>
            <label style={{ ...lbl, marginTop: 0 }}>Title (หัวเรื่องบน Google) <Counter n={title.length} ok={60} warn={70} /></label>
            <input style={inp} value={title} onChange={e => { setTitle(e.target.value); setSaved(false); }} placeholder="เช่น รอกตกปลามือสอง ราคาดี | ClubAngler" />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>เขียว ≤60 (โชว์เต็ม) · เหลือง 61–70 (Google อาจตัดท้าย) · ระบบตัดที่ 70</div>

            <label style={lbl}>Description (คำอธิบายใต้หัวเรื่อง) <Counter n={desc.length} ok={150} warn={170} /></label>
            <textarea style={{ ...inp, resize: "vertical", minHeight: 64 }} value={desc} onChange={e => { setDesc(e.target.value); setSaved(false); }} />

            {isCat && (
              <>
                <label style={lbl}>ย่อหน้าแนะนำหน้าหมวด <span style={{ fontWeight: 400, color: C.muted, fontSize: 11 }}>(โชว์ใต้หัวข้อหน้าหมวด — ให้ Google มีเนื้อหาอ่าน)</span></label>
                <textarea style={{ ...inp, resize: "vertical", minHeight: 84 }} value={intro} onChange={e => { setIntro(e.target.value); setSaved(false); }} />
              </>
            )}

            <SerpPreview title={title} description={desc} url={cur.url} />

            <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
              <button onClick={save} disabled={busy} style={{ font: "inherit", fontSize: 13, fontWeight: 700, borderRadius: 10, padding: "9px 20px", cursor: busy ? "wait" : "pointer", border: "none", background: C.brand, color: "#fff", opacity: busy ? .6 : 1 }}>
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { const r = rows[cur.key] || {}; setTitle(r.title || ""); setDesc(r.description || ""); setIntro(r.intro_html || ""); setSaved(false); }}
                style={{ font: "inherit", fontSize: 13, fontWeight: 700, borderRadius: 10, padding: "9px 16px", cursor: "pointer", border: `1px solid ${C.brand}`, background: "#fff", color: C.brand }}>
                คืนค่าที่บันทึกไว้
              </button>
              {saved && <span style={{ fontSize: 12, color: C.ok, fontWeight: 700 }}>✓ บันทึกแล้ว — มีผลบนหน้าเว็บทันที</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
