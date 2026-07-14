# patch-price-final.py — GRID-10: สเปกป้ายราคาฉบับจูนเสร็จ + ราคากึ่งกลางกรอบเป๊ะ
# ค่าที่ภีมจูนจาก mock (ฟอนต์ · ช่องไฟบนล่าง×ซ้ายขวา · มุมโค้ง · ขยายกรอบ%):
#   มือถือ: 2 คอลัมน์ = 12 · 3×7 · 5 · 150%   | 3 = 9 · 4×10 · 6 · 85%
#   เว็บ:   3 = 14.5 · 4×10 · 9 · 165% | 4 = 13 · 3×8 · 8 · 160% | 5 = 12 · 5×8 · 8 · 135%
# + แก้ราคาไม่กึ่งกลางกรอบ (บั๊ก lineHeight/ฟอนต์ไทย) → จัดกึ่งกลางด้วย flex
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-price-final.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

if "pricePill" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) signature: priceScale → pill object ──
A = "function MasonryCard({ p, idx, router, hold, priceScale = 1 }) {"
B = "function MasonryCard({ p, idx, router, hold, pill = { f: 12.5, v: 4, h: 9, r: 7 } }) {"
src = rep(A, B, "signature")

# ── 2) pill container: ค่าตรงจาก config + จัดกึ่งกลางด้วย flex ──
A = '        <div style={{ position: "absolute", bottom: Math.round(8 * priceScale), left: Math.round(8 * priceScale), background: "rgba(0,0,0,.30)", backdropFilter: "blur(6px)", borderRadius: 7 /* GRID-8: pill กลมเต็มทำให้กรอบไม่รัด */, padding: `${Math.max(2, Math.round(3.5 * priceScale))}px ${Math.max(5, Math.round(8 * priceScale))}px` }}>'
B = '        <div style={{ position: "absolute", bottom: 7, left: 7, background: "rgba(0,0,0,.30)", backdropFilter: "blur(6px)", borderRadius: pill.r, padding: `${pill.v}px ${pill.h}px`, display: "flex", alignItems: "center", justifyContent: "center" }}>{/* GRID-10: flex center = ราคากึ่งกลางกรอบเป๊ะ */}'
src = rep(A, B, "pill container")

# ── 3) ตัวเลขราคา ──
A = '          <span style={{ fontSize: +(12.5 * priceScale).toFixed(1), fontWeight: 700, color: "#fff", lineHeight: 1, display: "block" }}>THB {Number(p.price || 0).toLocaleString()}</span>{/* GRID-9: lineHeight 1 ตัดที่จองวรรณยุกต์ของฟอนต์ไทย */}'
B = '          <span style={{ fontSize: pill.f, fontWeight: 700, color: "#fff", lineHeight: 1 }}>THB {Number(p.price || 0).toLocaleString()}</span>'
src = rep(A, B, "ตัวเลขราคา")

# ── 4) memo: priceScale → pricePill (สเปกเต็มต่อคอลัมน์ แยกมือถือ/เว็บ) ──
A = NL.join([
    "  // GRID-4: สเกลป้ายราคาตามจำนวนคอลัมน์ (ค่าที่จูนจาก mock: มือถือ 2→86% 3→68% · เว็บ 3→105% 4→92% 5→86%)",
    "  const priceScale = useMemo(() => {",
    '    const m = smallScr ? { 2: 0.86, 3: 0.68 } : { 3: 1.05, 4: 0.92, 5: 0.86 }; // GRID-7: ตัวเลขตามจูนครั้งแรก + กรอบ base เล็กลง (3.5×8) รัดตัวเลขพอดี',
    "    return m[nCols] ?? 1;",
    "  }, [smallScr, nCols]);",
])
B = NL.join([
    "  // GRID-10: สเปกป้ายราคาที่จูนจาก mock 14 ก.ค. 2026 — f ฟอนต์ / v×h ช่องไฟ / r มุมโค้ง / b ตัวคูณขยายกรอบ",
    "  const pricePill = useMemo(() => {",
    "    const T = smallScr",
    "      ? { 2: { f: 12, v: 3, h: 7, r: 5, b: 1.5 }, 3: { f: 9, v: 4, h: 10, r: 6, b: 0.85 } }",
    "      : { 3: { f: 14.5, v: 4, h: 10, r: 9, b: 1.65 }, 4: { f: 13, v: 3, h: 8, r: 8, b: 1.6 }, 5: { f: 12, v: 5, h: 8, r: 8, b: 1.35 } };",
    "    const c = T[nCols] || { f: 12.5, v: 4, h: 9, r: 7, b: 1 };",
    "    return { f: c.f, v: Math.round(c.v * c.b), h: Math.round(c.h * c.b), r: c.r };",
    "  }, [smallScr, nCols]);",
])
src = rep(A, B, "pricePill memo")

# ── 5) จุดเรียก MasonryCard ──
A = "priceScale={priceScale} />)}"
B = "pill={pricePill} />)}"
src = rep(A, B, "prop เข้า MasonryCard")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-10 สเปกป้ายฉบับจูนเสร็จ + ราคากึ่งกลาง · CRLF=" + str(crlf))
