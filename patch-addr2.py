# -*- coding: utf-8 -*-
# patch-addr2.py — ADDR-2: ยกระดับที่อยู่เป็นแบบกันกรอกผิด (ตาม mock ที่เคาะแล้ว)
#   · components/AddrPicker.js ใหม่ — 4 ช่องในตัวเดียว:
#     ทาง 1: พิมพ์รหัส (เด้งตั้งแต่ 4 หลัก) → ตารางตัวเลือก จิ้มแถวเดียวเติมครบ
#     ทาง 2: จังหวัด → เขต → แขวง (dropdown ล้วน กรอกมั่วไม่ได้) → รหัสเติมเอง
#     · เปลี่ยนจังหวัด = เขต/แขวง/รหัส รีเซ็ต (กันชุดค้าง) · ข้อความยาวตัดบรรทัดได้ ไม่ล้นกรอบ
#     · โหลด /addr-th.json ไม่ได้ = ถอยกลับเป็นช่องพิมพ์ธรรมดา (ฟอร์มไม่มีทางตัน)
#     · ค่าเดิมที่สะกดไม่ตรงฐาน (ที่อยู่เก่าตอนแก้ไข) = แทรกเป็นตัวเลือก "(ค่าเดิม)" ให้เลือกต่อได้
#   · แทน ZipAutofill (ADDR-1) ใน 3 ฟอร์ม — ช่องพิมพ์ sub/district/province/zip เดิมถูกแทนด้วย AddrPicker
# กติกา: anchor บรรทัดเดียว + assert count == 1 + newline ต่อไฟล์ + marker ADDR-2 + all-or-nothing
# วิธีรัน: py patch-addr2.py

import io, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
P  = os.path.join(ROOT, "app", "profile", "ProfileClient.js")
C1 = os.path.join(ROOT, "app", "checkout", "[productId]", "CheckoutClient.js")
C2 = os.path.join(ROOT, "app", "checkout", "CheckoutCartClient.js")
COMP = os.path.join(ROOT, "components", "AddrPicker.js")

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()
def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

for p in (P, C1, C2):
    if "ADDR-2" in read(p):
        print("SKIP: พบ marker ADDR-2 ใน", os.path.relpath(p, ROOT), "— เคยรันแล้ว ไม่ทำซ้ำ"); sys.exit(0)
if os.path.exists(COMP):
    print("SKIP: มี components/AddrPicker.js อยู่แล้ว — เคยรันแล้ว ไม่ทำซ้ำ"); sys.exit(0)

COMP_SRC = "\r\n".join([
'"use client";',
'// components/AddrPicker.js — ADDR-2: บล็อกที่อยู่แบบกันกรอกผิด (แทน ZipAutofill/ช่องพิมพ์เดิมทั้ง 4 ช่อง)',
'// ใช้กับ form ที่มี key: sub, district, province, zip — คุมทั้ง 4 ช่องในตัวเดียว',
'import { useEffect, useMemo, useRef, useState } from "react";',
'',
'let CACHE = null, LOADING = null;',
'async function loadZips() {',
'  if (CACHE) return CACHE;',
'  if (!LOADING) LOADING = fetch("/addr-th.json").then(r => (r.ok ? r.json() : null)).catch(() => null);',
'  CACHE = await LOADING;',
'  return CACHE;',
'}',
'',
'const C = { brand: "#0E7E8C", tint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC", danger: "#C24D42" };',
'',
'export default function AddrPicker({ form, setForm, errKeys = [] }) {',
'  const [data, setData] = useState(undefined);   // undefined = กำลังโหลด · null = โหลดไม่ได้ (ถอยเป็นช่องพิมพ์)',
'  const [open, setOpen] = useState(false);',
'  const boxRef = useRef(null);',
'  useEffect(() => { loadZips().then(setData); }, []);',
'  useEffect(() => {',
'    const close = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };',
'    document.addEventListener("click", close);',
'    return () => document.removeEventListener("click", close);',
'  }, []);',
'',
'  // ดัชนี: จังหวัด → เขต → แขวง(+zip) สร้างครั้งเดียวจากฐาน zip',
'  const idx = useMemo(() => {',
'    if (!data) return null;',
'    const provs = new Map();',
'    for (const [z, list] of Object.entries(data)) for (const r of list) {',
'      if (!provs.has(r.p)) provs.set(r.p, new Map());',
'      const d = provs.get(r.p);',
'      if (!d.has(r.d)) d.set(r.d, []);',
'      d.get(r.d).push({ s: r.s, z });',
'    }',
'    return provs;',
'  }, [data]);',
'',
'  const zip = String(form.zip || "");',
'  const hits = useMemo(() => {',
'    if (!data || zip.length < 4) return [];',
'    const out = [];',
'    for (const [z, list] of Object.entries(data)) if (z.startsWith(zip)) for (const r of list) { out.push({ z, ...r }); if (out.length >= 30) return out; }',
'    return out;',
'  }, [data, zip]);',
'',
'  const set = patch => setForm(f => ({ ...f, ...patch }));',
'  const err = k => errKeys.includes(k);',
'  const inputS = k => ({ width: "100%", height: 42, borderRadius: 9, padding: "0 12px", fontSize: 13.5, boxSizing: "border-box", outline: "none", background: "#fff", color: C.ink, fontFamily: "inherit", border: `1.5px solid ${err(k) ? C.danger : C.line}` });',
'',
'  // ── ฐานโหลดไม่ได้ → ช่องพิมพ์ธรรมดา (พฤติกรรมเดิมทุกอย่าง ฟอร์มไม่ตัน) ──',
'  if (data === null) return (',
'    <>',
'      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, gridColumn: "1 / -1" }}>',
'        <input value={form.sub || ""} placeholder="ตำบล/แขวง *" onChange={e => set({ sub: e.target.value })} style={inputS("sub")} />',
'        <input value={form.district || ""} placeholder="อำเภอ/เขต *" onChange={e => set({ district: e.target.value })} style={inputS("district")} />',
'      </div>',
'      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, gridColumn: "1 / -1" }}>',
'        <input value={form.province || ""} placeholder="จังหวัด *" onChange={e => set({ province: e.target.value })} style={inputS("province")} />',
'        <input value={zip} placeholder="รหัสไปรษณีย์ 5 หลัก *" inputMode="numeric" onChange={e => set({ zip: e.target.value.replace(/\\D/g, "").slice(0, 5) })} style={inputS("zip")} />',
'      </div>',
'    </>',
'  );',
'',
'  const provOpts = idx ? [...idx.keys()].sort((a, b) => a.localeCompare(b, "th")) : [];',
'  const distOpts = idx && form.province && idx.has(form.province) ? [...idx.get(form.province).keys()].sort((a, b) => a.localeCompare(b, "th")) : [];',
'  const subOpts  = idx && form.province && form.district && idx.get(form.province)?.has(form.district) ? idx.get(form.province).get(form.district) : [];',
'  // ค่าเดิมที่ไม่อยู่ในฐาน (ที่อยู่เก่า) — แทรกให้เลือกต่อได้ ไม่หายเงียบ',
'  const withCur = (opts, cur) => (cur && !opts.includes(cur) ? [cur, ...opts] : opts);',
'',
'  const selS = k => ({ ...inputS(k), padding: "0 8px", appearance: "auto" });',
'  const pick = r => { set({ zip: r.z, province: r.p, district: r.d, sub: r.s }); setOpen(false); };',
'',
'  return (',
'    <>',
'      <div ref={boxRef} style={{ position: "relative", gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>',
'        <input value={zip} placeholder="รหัสไปรษณีย์ 5 หลัก *" inputMode="numeric" autoComplete="off"',
'          onChange={e => { set({ zip: e.target.value.replace(/\\D/g, "").slice(0, 5) }); setOpen(true); }}',
'          onFocus={() => setOpen(true)} style={inputS("zip")} />',
'        <select value={form.province || ""} style={selS("province")}',
'          onChange={e => set({ province: e.target.value, district: "", sub: "", zip: "" })}>',
'          <option value="">เลือกจังหวัด *</option>',
'          {withCur(provOpts, form.province).map(p => <option key={p} value={p}>{p}</option>)}',
'        </select>',
'        {open && hits.length > 0 && (',
'          <div style={{ position: "absolute", top: 46, left: 0, right: 0, zIndex: 30, background: "#fff", border: `1.5px solid ${C.brand}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 10px 28px rgba(16,19,20,.18)", maxHeight: 260, overflowY: "auto" }}>',
'            <div style={{ padding: "7px 12px", fontSize: 10.5, fontWeight: 700, color: C.muted, background: "#F6F9F9" }}>จิ้มแถวเดียว — ระบบเติมให้ครบทั้ง 4 ช่อง</div>',
'            {hits.map((r, i) => (',
'              <div key={i} onClick={() => pick(r)}',
'                style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", fontSize: 12.5, cursor: "pointer", borderTop: `1px solid ${C.line}` }}>',
'                <b style={{ color: C.brand, flex: "none" }}>{r.z}</b>',
'                {/* ตัดบรรทัดได้เสมอ กันชื่อยาวล้นกรอบบนมือถือ */}',
'                <span style={{ minWidth: 0, overflowWrap: "anywhere", color: C.ink }}>{r.s} · {r.d} · {r.p}</span>',
'              </div>',
'            ))}',
'          </div>',
'        )}',
'      </div>',
'      <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>',
'        <select value={form.district || ""} disabled={!form.province} style={{ ...selS("district"), opacity: form.province ? 1 : .55 }}',
'          onChange={e => set({ district: e.target.value, sub: "", zip: "" })}>',
'          <option value="">{form.province ? "เลือกอำเภอ/เขต *" : "อำเภอ/เขต (เลือกจังหวัดก่อน)"}</option>',
'          {withCur(distOpts, form.district).map(d => <option key={d} value={d}>{d}</option>)}',
'        </select>',
'        <select value={form.sub || ""} disabled={!form.district} style={{ ...selS("sub"), opacity: form.district ? 1 : .55 }}',
'          onChange={e => { const o = subOpts.find(x => x.s === e.target.value); set({ sub: e.target.value, ...(o ? { zip: o.z } : {}) }); }}>',
'          <option value="">{form.district ? "เลือกตำบล/แขวง *" : "ตำบล/แขวง (เลือกอำเภอก่อน)"}</option>',
'          {withCur(subOpts.map(o => o.s), form.sub).map(s => <option key={s} value={s}>{s}</option>)}',
'        </select>',
'      </div>',
'    </>',
'  );',
'}',
''])

JOBS = [
    # Profile: แถว sub/district → AddrPicker (คุมครบ 4 ช่อง)
    (P,
     '{input("sub", "ตำบล/แขวง *")}{input("district", "อำเภอ/เขต *")}',
     '<AddrPicker form={form} setForm={setForm} errKeys={showErr ? invalid(form) : []} /> {/* ADDR-2 */}'),
    # Profile: แถว province/zip เดิม (รวม ZipAutofill) → เอาออก
    (P,
     '{input("province", "จังหวัด *")}{input("zip", "รหัสไปรษณีย์ 5 หลัก *")}<ZipAutofill form={form} setForm={setForm} /> {/* ADDR-1 */}',
     ''),
    (P,
     'import ZipAutofill from "@/components/ZipAutofill"; // ADDR-1',
     'import AddrPicker from "@/components/AddrPicker"; // ADDR-2'),
    # Checkout เดี่ยว
    (C1,
     '>{input("sub")}{input("district")}</div>',
     '><AddrPicker form={form} setForm={setForm} /></div> {/* ADDR-2 */}'),
    (C1,
     '>{input("province")}{input("zip")}<ZipAutofill form={form} setForm={setForm} /></div> {/* ADDR-1 */}',
     '></div>'),
    (C1,
     'import ZipAutofill from "@/components/ZipAutofill"; // ADDR-1',
     'import AddrPicker from "@/components/AddrPicker"; // ADDR-2'),
    # Checkout ตะกร้า
    (C2,
     '>{input("sub")}{input("district")}</div>',
     '><AddrPicker form={form} setForm={setForm} /></div> {/* ADDR-2 */}'),
    (C2,
     '>{input("province")}{input("zip")}<ZipAutofill form={form} setForm={setForm} /></div> {/* ADDR-1 */}',
     '></div>'),
    (C2,
     'import ZipAutofill from "@/components/ZipAutofill"; // ADDR-1',
     'import AddrPicker from "@/components/AddrPicker"; // ADDR-2'),
]

contents = {p: read(p) for p in (P, C1, C2)}
for path, old, _new in JOBS:
    n = contents[path].count(old)
    assert n == 1, "anchor เจอ %d ใน %s: %s" % (n, os.path.relpath(path, ROOT), old[:60])

os.makedirs(os.path.dirname(COMP), exist_ok=True)
write(COMP, COMP_SRC)
print("OK: สร้าง components/AddrPicker.js")
for path, old, new in JOBS:
    contents[path] = contents[path].replace(old, new, 1)
for p, s in contents.items():
    write(p, s)
    print("OK: patch", os.path.relpath(p, ROOT))
print("DONE: ADDR-2 ครบ 4 ไฟล์ — ต่อไป: npm run build")
