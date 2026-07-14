# patch-price-scale4.py — GRID-7: ตัวเลขตามจูนครั้งแรก (GRID-4) + กรอบเบลอรัดแน่นไม่กินพื้นที่
# ฟอนต์: 12.5 × scale (มือถือ 2→86% 3→68% · เว็บ 3→105% 4→92% 5→86%)
# กรอบ: base padding ลดจาก 5×12 → 3.5×8 แล้วคูณ scale เดียวกัน → กรอบรัดตัวเลขพอดี
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-price-scale4.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

if "GRID-7" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) ฟอนต์คืนสูตรครั้งแรก ──
A = '          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>THB {Number(p.price || 0).toLocaleString()}</span>'
B = '          <span style={{ fontSize: +(12.5 * priceScale).toFixed(1), fontWeight: 700, color: "#fff" }}>THB {Number(p.price || 0).toLocaleString()}</span>'
src = rep(A, B, "ฟอนต์ตามสเกล")

# ── 2) กรอบรัดแน่น: base padding 5×12 → 3.5×8 ──
A = 'padding: `${Math.round(5 * priceScale)}px ${Math.round(12 * priceScale)}px` }}>'
B = 'padding: `${Math.max(2, Math.round(3.5 * priceScale))}px ${Math.max(5, Math.round(8 * priceScale))}px` }}>'
src = rep(A, B, "กรอบรัดแน่น")

# ── 3) ค่าสเกลคืนชุดที่จูนครั้งแรก ──
A = "    const m = smallScr ? { 2: 0.6, 3: 0.45 } : { 3: 1, 4: 0.8, 5: 0.7 }; // GRID-6: scale คุมเฉพาะกรอบเบลอ+ระยะมุม (ตัวเลขคงที่ 12.5 เสมอ)"
B = "    const m = smallScr ? { 2: 0.86, 3: 0.68 } : { 3: 1.05, 4: 0.92, 5: 0.86 }; // GRID-7: ตัวเลขตามจูนครั้งแรก + กรอบ base เล็กลง (3.5×8) รัดตัวเลขพอดี"
src = rep(A, B, "ค่าสเกลคืน GRID-4")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-7 ตัวเลขตามจูนแรก + กรอบรัดแน่น")
