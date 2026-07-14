# patch-price-lineheight.py — GRID-9: ช่องไฟบน-ล่างมาจาก line-height ฟอนต์ไทย (จองที่วรรณยุกต์)
# แก้: lineHeight 1 + display block ที่ตัวเลขราคา — กรอบยุบลงรัดตัวเลขจริง
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-price-lineheight.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

if "GRID-9" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

A = '          <span style={{ fontSize: +(12.5 * priceScale).toFixed(1), fontWeight: 700, color: "#fff" }}>THB {Number(p.price || 0).toLocaleString()}</span>'
B = '          <span style={{ fontSize: +(12.5 * priceScale).toFixed(1), fontWeight: 700, color: "#fff", lineHeight: 1, display: "block" }}>THB {Number(p.price || 0).toLocaleString()}</span>{/* GRID-9: lineHeight 1 ตัดที่จองวรรณยุกต์ของฟอนต์ไทย */}'
src = rep(A, B, "lineHeight ราคา")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-9 กรอบยุบรัดตัวเลข (lineHeight 1)")
