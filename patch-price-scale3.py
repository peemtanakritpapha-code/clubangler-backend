# patch-price-scale3.py — GRID-6: ตัวเลขราคาเท่าเดิมทุกจอ — หดเฉพาะ "กรอบเบลอ" รอบราคา
# ฟอนต์: กลับเป็น 12.5 คงที่ · priceScale คุมแค่ padding กรอบ + ระยะห่างมุม
# กรอบ: มือถือ 2 คอลัมน์ = 60% · 3 = 45% · เว็บ 3 = 100% · 4 = 80% · 5 = 70%
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-price-scale3.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

if "GRID-6" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) ฟอนต์ราคากลับคงที่ 12.5 ทุกจอ ──
A = '          <span style={{ fontSize: +(12.5 * priceScale).toFixed(1), fontWeight: 700, color: "#fff" }}>THB {Number(p.price || 0).toLocaleString()}</span>'
B = '          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>THB {Number(p.price || 0).toLocaleString()}</span>'
src = rep(A, B, "ฟอนต์คงที่")

# ── 2) scale คุมเฉพาะกรอบ — ค่าใหม่ ──
A = "    const m = smallScr ? { 2: 0.78, 3: 0.52 } : { 3: 1.05, 4: 0.92, 5: 0.86 }; // GRID-5: มือถือหดลงอีก (ป้ายบังภาพ)"
B = "    const m = smallScr ? { 2: 0.6, 3: 0.45 } : { 3: 1, 4: 0.8, 5: 0.7 }; // GRID-6: scale คุมเฉพาะกรอบเบลอ+ระยะมุม (ตัวเลขคงที่ 12.5 เสมอ)"
src = rep(A, B, "ค่าสเกลกรอบ")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-6 ตัวเลขเท่าเดิม กรอบเบลอหดตามคอลัมน์")
