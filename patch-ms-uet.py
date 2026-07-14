# patch-ms-uet.py — MSUET-1: ฝัง Microsoft UET tag (Tag ID 343260104) ใน layout.js
# รันที่รากโปรเจกต์: python patch-ms-uet.py
# ใช้ยืนยันโดเมน clubangler.com กับ Microsoft Merchant Center + เก็บ conversion ในอนาคต
import io, sys

PATH = "app/layout.js"
MARK = "MSUET-1"
NL = "\r\n"

src = io.open(PATH, encoding="utf-8", newline="").read()

if MARK in src:
    print("ข้าม: ไฟล์ถูก patch แล้ว (พบ marker MSUET-1) — ไม่ทำซ้ำ")
    sys.exit(0)

def rep(tag, anchor, new):
    global src
    n = src.count(anchor)
    assert n == 1, f"[{tag}] anchor พบ {n} ครั้ง (ต้องเป็น 1) — หยุดทันที ไม่แตะไฟล์"
    src = src.replace(anchor, new)
    print(f"[{tag}] OK")

# ── A: import next/script ──
rep("A import Script",
    'import SwRegister from "@/components/SwRegister";',
    'import SwRegister from "@/components/SwRegister";' + NL +
    'import Script from "next/script"; // MSUET-1')

# ── B: ฝังแท็ก UET หลัง JSON-LD ──
UET_JS = '(function(w, d, t, u, o) {w[u] = w[u] || [], o.ts = (new Date).getTime();var n = d.createElement(t);n.src = "https://bat.bing.net/bat.js?ti=" + o.ti + ("uetq" != u ? "&q=" + u : ""),n.async = 1, n.onload = n.onreadystatechange = function() {var s = this.readyState;s && "loaded" !== s && "complete" !== s ||(o.q = w[u], w[u] = new UET(o), w[u].push("pageLoad"),n.onload = n.onreadystatechange = null)};var i = d.getElementsByTagName(t)[0];i.parentNode.insertBefore(n, i);})(window, document, "script", "uetq", {ti: "343260104",enableAutoSpaTracking: true});'
rep("B UET tag",
    '        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />',
    '        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />' + NL +
    "        {/* MSUET-1: Microsoft UET tag — ยืนยันโดเมนกับ Microsoft Merchant (Tag ID 343260104) */}" + NL +
    "        <Script id=\"ms-uet\" strategy=\"afterInteractive\" dangerouslySetInnerHTML={{ __html: '" + UET_JS + "' }} />")

io.open(PATH, "w", encoding="utf-8", newline="").write(src)
print("เขียนไฟล์เรียบร้อย —", PATH)

for a, b in [("{", "}"), ("(", ")")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"วงเล็บ {a}{b} ไม่สมดุล: {ca} vs {cb}"
print("วงเล็บสมดุลครบ ✓ เสร็จสมบูรณ์")
