# patch-price-scale.py — GRID-4: ป้ายราคา (dark pill) สเกลตามจำนวนคอลัมน์
# ค่าที่ภีมจูนจาก mock 14 ก.ค. 2026:
#   มือถือ: 2 คอลัมน์ = 86% · 3 = 68%
#   เว็บ:   3 = 105% · 4 = 92% · 5 = 86%
# สเกลคูณทั้ง ฟอนต์ / padding / ระยะห่างมุม — ป้ายเล็กลงตามการ์ด ไม่บังสินค้า
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-price-scale.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "priceScale" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

assert "renderGridCtl" in src, "ต้องรัน GRID-1/GRID-2 ก่อน"

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) MasonryCard รับ priceScale ──
A = "function MasonryCard({ p, idx, router, hold }) {"
B = "function MasonryCard({ p, idx, router, hold, priceScale = 1 }) {"
src = rep(A, B, "MasonryCard signature")

# ── 2) ป้ายราคา: คูณสเกลทั้งฟอนต์/padding/ระยะมุม ──
A = '        <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,.30)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "5px 12px" }}>'
B = '        <div style={{ position: "absolute", bottom: Math.round(8 * priceScale), left: Math.round(8 * priceScale), background: "rgba(0,0,0,.30)", backdropFilter: "blur(6px)", borderRadius: 999, padding: `${Math.round(5 * priceScale)}px ${Math.round(12 * priceScale)}px` }}>'
src = rep(A, B, "pill container")

A = '          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>THB {Number(p.price || 0).toLocaleString()}</span>'
B = '          <span style={{ fontSize: +(12.5 * priceScale).toFixed(1), fontWeight: 700, color: "#fff" }}>THB {Number(p.price || 0).toLocaleString()}</span>'
src = rep(A, B, "pill font")

# ── 3) คำนวณสเกลใน MarketClient — เกาะหลัง nCols useMemo (GRID-1) ──
A = "  }, [userCols, autoCols, smallScr]);"
B = A + NL + NL.join([
    "  // GRID-4: สเกลป้ายราคาตามจำนวนคอลัมน์ (ค่าที่จูนจาก mock: มือถือ 2→86% 3→68% · เว็บ 3→105% 4→92% 5→86%)",
    "  const priceScale = useMemo(() => {",
    "    const m = smallScr ? { 2: 0.86, 3: 0.68 } : { 3: 1.05, 4: 0.92, 5: 0.86 };",
    "    return m[nCols] ?? 1;",
    "  }, [smallScr, nCols]);",
])
src = rep(A, B, "priceScale memo")

# ── 4) ส่ง prop เข้า MasonryCard ──
A = "{col.map(({ p, i }) => <MasonryCard key={p.id} p={p} idx={i} router={router} hold={holds[p.id]} />)}"
B = "{col.map(({ p, i }) => <MasonryCard key={p.id} p={p} idx={i} router={router} hold={holds[p.id]} priceScale={priceScale} />)}"
src = rep(A, B, "ส่ง prop priceScale")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-4 ป้ายราคาสเกลตามคอลัมน์ · CRLF=" + str(crlf))
