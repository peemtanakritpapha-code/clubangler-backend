# -*- coding: utf-8 -*-
# patch-addr1.py — D3 ADDR-1: กรอกรหัสไปรษณีย์ → ตำบล/อำเภอ/จังหวัด ขึ้นให้อัตโนมัติ
# ทำ 3 อย่าง:
#   1) components/ZipAutofill.js — component กลาง: zip ครบ 5 หลัก → โหลด public/addr-th.json (โหลดครั้งเดียว แคชไว้)
#      · จังหวัด/อำเภอ ตรงกันทุกตัวเลือก = เติมให้ทันที · มีตำบลเดียว = เติมครบเลย · หลายตำบล = เด้ง select ให้เลือก
#      · รหัสไม่อยู่ในฐาน = เงียบ ผู้ใช้พิมพ์เองได้เหมือนเดิม (ช่องกรอกเดิมอยู่ครบทุกช่อง)
#   2) scripts/build-addr.mjs — แปลงไฟล์ดิบ kongvut → public/addr-th.json แบบกะทัดรัด (zip → [{s,d,p}])
#   3) เสียบ <ZipAutofill/> ใน 3 ฟอร์ม: ProfileClient · CheckoutClient · CheckoutCartClient
# กติกา: anchor บรรทัดเดียว + assert count == 1 + ตรวจ newline ต่อไฟล์ (Iron Rule ใหม่) + marker ADDR-1 + all-or-nothing
# วิธีรัน (จากโฟลเดอร์โปรเจกต์): py patch-addr1.py

import io, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
P  = os.path.join(ROOT, "app", "profile", "ProfileClient.js")
C1 = os.path.join(ROOT, "app", "checkout", "[productId]", "CheckoutClient.js")
C2 = os.path.join(ROOT, "app", "checkout", "CheckoutCartClient.js")
COMP  = os.path.join(ROOT, "components", "ZipAutofill.js")
BUILD = os.path.join(ROOT, "scripts", "build-addr.mjs")

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()
def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

for p in (P, C1, C2):
    if "ADDR-1" in read(p):
        print("SKIP: พบ marker ADDR-1 ใน", os.path.relpath(p, ROOT), "— เคยรันแล้ว ไม่ทำซ้ำ"); sys.exit(0)
if os.path.exists(COMP):
    print("SKIP: มี components/ZipAutofill.js อยู่แล้ว — เคยรันแล้ว ไม่ทำซ้ำ"); sys.exit(0)

COMP_SRC = "\r\n".join([
'"use client";',
'// components/ZipAutofill.js — ADDR-1: เติมที่อยู่จากรหัสไปรษณีย์ (ใช้ร่วม 3 ฟอร์ม: โปรไฟล์ + checkout เดี่ยว/ตะกร้า)',
'// ข้อมูล: public/addr-th.json (สร้างจาก scripts/build-addr.mjs) — โหลดครั้งแรกที่ zip ครบ 5 หลัก แล้วแคชทั้งแอป',
'// หลักการ: ไม่แตะช่องกรอกเดิม — รหัสไม่อยู่ในฐานข้อมูล = เงียบ ผู้ใช้พิมพ์เองได้เหมือนเดิมทุกอย่าง',
'import { useEffect, useState } from "react";',
'',
'let CACHE = null, LOADING = null;',
'async function loadZips() {',
'  if (CACHE) return CACHE;',
'  if (!LOADING) LOADING = fetch("/addr-th.json").then(r => (r.ok ? r.json() : {})).catch(() => ({}));',
'  CACHE = await LOADING;',
'  return CACHE;',
'}',
'',
'const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A" };',
'',
'export default function ZipAutofill({ form, setForm }) {',
'  const [opts, setOpts] = useState([]);',
'  const zip = String(form.zip || "");',
'',
'  useEffect(() => {',
'    let on = true;',
'    if (!/^[0-9]{5}$/.test(zip)) { setOpts([]); return; }',
'    loadZips().then(d => {',
'      if (!on) return;',
'      const list = d[zip] || [];',
'      setOpts(list);',
'      if (!list.length) return;',
'      // จังหวัด/อำเภอ: ทุกตัวเลือกตรงกัน = เติมให้เลย · ตำบลเดียว = เติมครบ',
'      const patch = {};',
'      if (list.every(x => x.p === list[0].p)) patch.province = list[0].p;',
'      if (list.every(x => x.d === list[0].d)) patch.district = list[0].d;',
'      if (list.length === 1) patch.sub = list[0].s;',
'      setForm(f => {',
'        const need = Object.keys(patch).filter(k => (f[k] || "") !== patch[k]);',
'        return need.length ? { ...f, ...Object.fromEntries(need.map(k => [k, patch[k]])) } : f;',
'      });',
'    });',
'    return () => { on = false; };',
'    // eslint-disable-next-line react-hooks/exhaustive-deps',
'  }, [zip]);',
'',
'  if (opts.length < 2) return null; // ตัวเลือกเดียว/ไม่เจอ = เติมเงียบๆ ไม่ต้องโชว์อะไร',
'  return (',
'    <select value="" onChange={e => { const o = opts[Number(e.target.value)]; if (o) setForm(f => ({ ...f, sub: o.s, district: o.d, province: o.p })); }}',
'      style={{ gridColumn: "1 / -1", width: "100%", height: 40, borderRadius: 9, padding: "0 10px", fontSize: 13, boxSizing: "border-box",',
'        background: C.brandTint, border: `1.5px solid ${C.brand}`, color: C.ink, outline: "none" }}>',
'      <option value="">📮 รหัส {zip} — เลือกตำบล/แขวง ({opts.length} ตัวเลือก) แล้วระบบเติมให้ครบ</option>',
'      {opts.map((o, i) => <option key={i} value={i}>{o.s} · {o.d} · {o.p}</option>)}',
'    </select>',
'  );',
'}',
''])

BUILD_SRC = "\r\n".join([
'// scripts/build-addr.mjs — ADDR-1: แปลงข้อมูลที่อยู่ไทยดิบ (kongvut) → public/addr-th.json แบบกะทัดรัด',
'// เตรียมไฟล์ดิบก่อน (ครั้งเดียว):',
'//   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_province_with_amphure_tambon.json" -OutFile scripts\\\\raw-thai-address.json',
'// แล้วรัน:  node scripts/build-addr.mjs',
'// ผลลัพธ์: public/addr-th.json — { "10230": [{ s: "ตำบล", d: "อำเภอ", p: "จังหวัด" }, ...], ... }',
'import fs from "fs";',
'',
'const RAW = "scripts/raw-thai-address.json";',
'if (!fs.existsSync(RAW)) { console.log("❌ ไม่พบ " + RAW + " — ดาวน์โหลดตามคำสั่งในคอมเมนต์หัวไฟล์ก่อน"); process.exit(1); }',
'const provinces = JSON.parse(fs.readFileSync(RAW, "utf8"));',
'',
'const map = {};',
'let n = 0;',
'for (const pv of provinces) {',
'  for (const am of pv.amphure || []) {',
'    for (const tb of am.tambon || []) {',
'      const zip = String(tb.zip_code || "").padStart(5, "0");',
'      if (!/^[0-9]{5}$/.test(zip)) continue;',
'      (map[zip] = map[zip] || []).push({ s: tb.name_th, d: am.name_th, p: pv.name_th });',
'      n++;',
'    }',
'  }',
'}',
'fs.mkdirSync("public", { recursive: true });',
'fs.writeFileSync("public/addr-th.json", JSON.stringify(map));',
'const kb = Math.round(fs.statSync("public/addr-th.json").size / 1024);',
'console.log("OK: ตำบล " + n + " รายการ · รหัสไปรษณีย์ " + Object.keys(map).length + " รหัส · public/addr-th.json ~" + kb + " KB");',
''])

# ═══ จุดเสียบ 3 ฟอร์ม (anchor บรรทัดเดียวทั้งหมด) ═══
JOBS = [
    (P,
     '{input("province", "จังหวัด *")}{input("zip", "รหัสไปรษณีย์ 5 หลัก *")}',
     '{input("province", "จังหวัด *")}{input("zip", "รหัสไปรษณีย์ 5 หลัก *")}<ZipAutofill form={form} setForm={setForm} /> {/* ADDR-1 */}'),
    (C1,
     '{input("province")}{input("zip")}</div>',
     '{input("province")}{input("zip")}<ZipAutofill form={form} setForm={setForm} /></div> {/* ADDR-1 */}'),
    (C2,
     '{input("province")}{input("zip")}</div>',
     '{input("province")}{input("zip")}<ZipAutofill form={form} setForm={setForm} /></div> {/* ADDR-1 */}'),
]
IMPORT_LINE = 'import ZipAutofill from "@/components/ZipAutofill"; // ADDR-1'

# ═══ ตรวจก่อนแตะ (all-or-nothing) ═══
contents = {p: read(p) for p in (P, C1, C2)}
nls = {}
for path, old, _new in JOBS:
    s = contents[path]
    nls[path] = "\r\n" if "\r\n" in s else "\n"   # Iron Rule ใหม่: ตรวจ newline ต่อไฟล์ ห้ามสมมติ
    assert s.count(old) == 1, "anchor เจอ %d ใน %s" % (s.count(old), os.path.relpath(path, ROOT))
    assert s.count('"use client";') == 1, "หา \"use client\" ไม่เจอใน " + os.path.relpath(path, ROOT)

# ═══ ลงมือ ═══
os.makedirs(os.path.dirname(COMP), exist_ok=True)
write(COMP, COMP_SRC)
print("OK: สร้าง components/ZipAutofill.js")
write(BUILD, BUILD_SRC)
print("OK: สร้าง scripts/build-addr.mjs")

for path, old, new in JOBS:
    nl = nls[path]
    s = contents[path]
    s = s.replace('"use client";', '"use client";' + nl + IMPORT_LINE, 1)
    s = s.replace(old, new, 1)
    contents[path] = s
for p, s in contents.items():
    write(p, s)
    print("OK: patch", os.path.relpath(p, ROOT))

print("DONE: ADDR-1 ครบ 5 ไฟล์")
print("ขั้นต่อไป: 1) ดาวน์โหลดไฟล์ดิบ (คำสั่งอยู่หัว scripts/build-addr.mjs)  2) node scripts/build-addr.mjs  3) npm run build")
