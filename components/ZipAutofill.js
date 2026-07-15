"use client";
// components/ZipAutofill.js — ADDR-1: เติมที่อยู่จากรหัสไปรษณีย์ (ใช้ร่วม 3 ฟอร์ม: โปรไฟล์ + checkout เดี่ยว/ตะกร้า)
// ข้อมูล: public/addr-th.json (สร้างจาก scripts/build-addr.mjs) — โหลดครั้งแรกที่ zip ครบ 5 หลัก แล้วแคชทั้งแอป
// หลักการ: ไม่แตะช่องกรอกเดิม — รหัสไม่อยู่ในฐานข้อมูล = เงียบ ผู้ใช้พิมพ์เองได้เหมือนเดิมทุกอย่าง
import { useEffect, useState } from "react";

let CACHE = null, LOADING = null;
async function loadZips() {
  if (CACHE) return CACHE;
  if (!LOADING) LOADING = fetch("/addr-th.json").then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  CACHE = await LOADING;
  return CACHE;
}

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A" };

export default function ZipAutofill({ form, setForm }) {
  const [opts, setOpts] = useState([]);
  const zip = String(form.zip || "");

  useEffect(() => {
    let on = true;
    if (!/^[0-9]{5}$/.test(zip)) { setOpts([]); return; }
    loadZips().then(d => {
      if (!on) return;
      const list = d[zip] || [];
      setOpts(list);
      if (!list.length) return;
      // จังหวัด/อำเภอ: ทุกตัวเลือกตรงกัน = เติมให้เลย · ตำบลเดียว = เติมครบ
      const patch = {};
      if (list.every(x => x.p === list[0].p)) patch.province = list[0].p;
      if (list.every(x => x.d === list[0].d)) patch.district = list[0].d;
      if (list.length === 1) patch.sub = list[0].s;
      setForm(f => {
        const need = Object.keys(patch).filter(k => (f[k] || "") !== patch[k]);
        return need.length ? { ...f, ...Object.fromEntries(need.map(k => [k, patch[k]])) } : f;
      });
    });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  if (opts.length < 2) return null; // ตัวเลือกเดียว/ไม่เจอ = เติมเงียบๆ ไม่ต้องโชว์อะไร
  return (
    <select value="" onChange={e => { const o = opts[Number(e.target.value)]; if (o) setForm(f => ({ ...f, sub: o.s, district: o.d, province: o.p })); }}
      style={{ gridColumn: "1 / -1", width: "100%", height: 40, borderRadius: 9, padding: "0 10px", fontSize: 13, boxSizing: "border-box",
        background: C.brandTint, border: `1.5px solid ${C.brand}`, color: C.ink, outline: "none" }}>
      <option value="">📮 รหัส {zip} — เลือกตำบล/แขวง ({opts.length} ตัวเลือก) แล้วระบบเติมให้ครบ</option>
      {opts.map((o, i) => <option key={i} value={i}>{o.s} · {o.d} · {o.p}</option>)}
    </select>
  );
}
