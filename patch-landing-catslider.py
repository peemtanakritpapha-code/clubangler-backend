# patch-landing-catslider.py — เพิ่มสายพานหมวดหมู่ (CatSlider v7.1) เข้าหน้าแรก Landing
# ตำแหน่ง: คั่นระหว่างแถบ escrow เขียว กับ section "สินค้าล่าสุด" (ภีมเคาะ A)
# เฉพาะ LandingClient (guest) — หน้าฟีดคนล็อกอินไม่แตะ
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-landing-catslider.py

import io, sys

PATH = "app/LandingClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "CatSlider" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว (พบ CatSlider ใน LandingClient) — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) import — เกาะ anchor import TimeLeft ──
A1 = 'import TimeLeft from "@/components/TimeLeft";'
B1 = A1 + NL + 'import CatSlider from "@/app/market/CatSlider"; // W1.1: สายพานหมวดหมู่ตัวเดียวกับหน้า /market'
src = rep(A1, B1, "import TimeLeft")

# ── 2) วาง section สไลด์เหนือ "สินค้าล่าสุด" ──
A2 = "      {/* สินค้าล่าสุด */}"
BLOCK = (
    "      {/* W1.1: สายพานหมวดหมู่ — ตัวเดียวกับหน้า /market (กดการ์ด → หน้าหมวด) */}" + NL
    + '      <section style={{ padding: "18px 0 0", background: C.white }}>' + NL
    + '        <CatSlider title="ช้อปตามหมวดหมู่" auto />' + NL
    + "      </section>" + NL
    + NL
    + A2
)
src = rep(A2, BLOCK, "section สินค้าล่าสุด")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: LandingClient.js — เพิ่มสายพานหมวดหมู่เหนือสินค้าล่าสุดแล้ว · CRLF=" + str(crlf))
