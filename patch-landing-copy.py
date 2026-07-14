# patch-landing-copy.py — หน้าแรกโทนน้าๆ (W1.2) ตาม copy ที่ภีมเคาะ 14 ก.ค. 2026
# 1) badge:    Escrow ซื้อ-ขายปลอดภัย มั่นใจได้เลยครับน้า
# 2) headline: ตลาดอุปกรณ์ตกปลา หมดปัญหาโอนแล้วโดนเท
# 3) ซับไลน์:  ลงขายเลย ถ้าน้าร้อน ผมรอช้อนอยู่ครับ
# 4) หัวแถบ:   ทำไมน้าๆ ย้ายมาซื้อขายที่นี่ (ตัดซับใต้หัวออก)
# 5) การ์ด 3 ขั้นตอน → 4 จุดขาย (Escrow / ขี้เกียจขาย / นักต่อ / หาของ)
# 6) มือถือ: การ์ดจัด 2×2 · จอกว้าง: 4 ช่องแถวเดียว
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-landing-copy.py

import io, sys

PATH = "app/LandingClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "รอช้อนอยู่ครับ" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว (พบ copy ใหม่) — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) import: ตัด Lock/Package (เลิกใช้) เพิ่ม Bot/Tag/Search ──
A = 'import { Lock, Package, ShieldCheck, RotateCcw, Fish } from "lucide-react";'
B = 'import { ShieldCheck, RotateCcw, Fish, Bot, Tag, Search } from "lucide-react";'
src = rep(A, B, "lucide import")

# ── 2) state จอเล็ก (2×2) — แทรกเหนือ const steps ──
A = "  const steps = ["
B = (
    "  // W1.2: จอเล็ก → การ์ดจุดขายจัด 2×2 / จอกว้าง 4 ช่องแถวเดียว (แพทเทิร์นเดียวกับ CatSlider)" + NL
    + "  const [small, setSmall] = useState(false);" + NL
    + "  useEffect(() => {" + NL
    + "    const f = () => setSmall(window.innerWidth < 640);" + NL
    + '    f(); window.addEventListener("resize", f);' + NL
    + '    return () => window.removeEventListener("resize", f);' + NL
    + "  }, []);" + NL
    + "  const steps = ["
)
src = rep(A, B, "state small")

# ── 3) การ์ดใบ 1: Escrow ──
A = '    { icon: Lock, t: "1 · โอนเข้าบัญชีกลาง", d: "ผู้ซื้อชำระเข้าคนกลาง ไม่ใช่เข้าผู้ขายตรง" },'
B = '    { icon: ShieldCheck, t: "Escrow คนกลางถือเงิน", d: "เงินเข้าบัญชีกลาง ไม่เข้าผู้ขายตรง โดนเท = ได้คืน" },'
src = rep(A, B, "การ์ด 1")

# ── 4) การ์ดใบ 2: ระบบขี้เกียจขาย ──
A = '    { icon: Package, t: "2 · ได้ของ แล้วยืนยัน", d: "ผู้ขายส่งของ ผู้ซื้อกดยืนยันเมื่อได้รับ" },'
B = '    { icon: Bot, t: "ระบบขี้เกียจขาย ฟรี", d: "AI Auto Title-Description — ถ่ายรูปอย่างเดียวจบ รอรับเงิน" },'
src = rep(A, B, "การ์ด 2")

# ── 5) การ์ดใบ 3 + เพิ่มใบ 4 ──
A = '    { icon: ShieldCheck, t: "3 · เงินถึงผู้ขาย", d: "ทีมงานโอนให้ผู้ขายในเวลาทำการ" },'
B = (
    '    { icon: Tag, t: "หมดปัญหานักต่อ", d: "ไม่มีระบบแชทต่อรอง อยากซื้อ..ซื้อ ไม่ซื้อแล้วแต่ !!" },' + NL
    + '    { icon: Search, t: "หาของง่ายๆ", d: "น้ารอช้อนได้ทุกหมวด หมดปัญหาสินค้ากระจัดกระจาย" },'
)
src = rep(A, B, "การ์ด 3+4")

# ── 6) badge บน hero ──
A = " ซื้อขายปลอดภัย มีคนกลางถือเงิน</div>"
B = " Escrow ซื้อ-ขายปลอดภัย มั่นใจได้เลยครับน้า</div>"
src = rep(A, B, "badge")

# ── 7) headline ──
A = ">ตลาดอุปกรณ์ตกปลามือสอง ที่ไม่ต้องกลัวโดนโกง</div>"
B = ">ตลาดอุปกรณ์ตกปลา หมดปัญหาโอนแล้วโดนเท</div>"
src = rep(A, B, "headline")

# ── 8) ซับไลน์ ──
A = ">โอนเงินเข้าบัญชีกลางก่อน ได้ของครบค่อยปล่อยให้ผู้ขาย — ปลอดภัยกว่าซื้อในกลุ่ม</p>"
B = ">ลงขายเลย ถ้าน้าร้อน ผมรอช้อนอยู่ครับ</p>"
src = rep(A, B, "ซับไลน์")

# ── 9) หัวแถบเขียว (ขยับ marginBottom 6→22 ชดเชยซับที่ตัดออก) ──
A = '        <div style={{ textAlign: "center", color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>ทำไมปลอดภัยกว่าซื้อขายในกลุ่มออนไลน์</div>'
B = '        <div style={{ textAlign: "center", color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 22 }}>ทำไมน้าๆ ย้ายมาซื้อขายที่นี่</div>'
src = rep(A, B, "หัวแถบ")

# ── 10) ตัดซับใต้หัวแถบทิ้งทั้งบรรทัด ──
A = '        <div style={{ textAlign: "center", color: "#CDEDE4", fontSize: 13, marginBottom: 22 }}>เงินของคุณถูกพักไว้จนกว่าจะได้รับของ</div>' + NL
src = rep(A, "", "ตัดซับแถบ")

# ── 11) grid การ์ด: มือถือ 2×2 / จอกว้าง 4 ช่อง ──
A = '<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, maxWidth: 640, margin: "0 auto" }}>'
B = '<div style={{ display: "grid", gridTemplateColumns: small ? "1fr 1fr" : "repeat(4,1fr)", gap: small ? 9 : 12, maxWidth: 860, margin: "0 auto" }}>'
src = rep(A, B, "grid การ์ด")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: LandingClient.js → W1.2 หน้าแรกโทนน้าๆ (copy ใหม่ + การ์ด 4 ใบ + มือถือ 2×2) · CRLF=" + str(crlf))
