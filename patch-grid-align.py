# patch-grid-align.py — GRID-3: หัวคอลัมน์เสมอกันทุกคอลัมน์ (ตัดการเยื้อง 24px ของคอลัมน์คู่)
# มีผลทุกจอ: เว็บ + มือถือ + แอพ (WebView ใช้โค้ดเดียวกัน)
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-grid-align.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "marginTop: ci % 2" not in src:
    print("SKIP: การเยื้องถูกตัดไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

A = '<div key={ci} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, marginTop: ci % 2 === 1 ? 24 : 0 }}>'
B = '<div key={ci} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>'
src = rep(A, B, "ตัดเยื้องคอลัมน์")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-3 หัวคอลัมน์เสมอกันทุกจอ")
