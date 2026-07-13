# patch-catslider-flow.py — แก้ CatSlider v7 → v7.1
# (1) หายกระตุกตอนครบใบ: เครื่องยนต์ย้ายไป useLayoutEffect (สลับการ์ด+reset รางก่อนจอวาด)
# (2) เลิกม้วนกลับหัวแถว: resume แล้วดูดซับระยะที่ผู้ใช้เลื่อนเข้าสายพาน วิ่งต่อจากจุดค้าง
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-catslider-flow.py

import io, sys

PATH = "app/market/CatSlider.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "useIsoLayoutEffect" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว (พบ useIsoLayoutEffect) — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) import เพิ่ม useLayoutEffect ──
A1 = 'import { useEffect, useRef, useState } from "react";'
B1 = 'import { useEffect, useLayoutEffect, useRef, useState } from "react";'
src = rep(A1, B1, "import react hooks")

# ── 2) ประกาศ hook ฝั่ง client (กัน SSR เตือน) ใต้ const N ──
A2 = "const N = CARDS.length;"
B2 = (
    "const N = CARDS.length;" + NL
    + '// v7.1: งาน DOM ที่ต้องเสร็จ "ก่อนจอวาด" — บนเซิร์ฟเวอร์ถอยไป useEffect กัน warning' + NL
    + 'const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;'
)
src = rep(A2, B2, "const N")

# ── 3) แทนที่บล็อกเครื่องยนต์ทั้งก้อน ──
# หัวบล็อก (คอมเมนต์บรรทัดเดียว unique) → ท้ายบล็อก (deps unique)
HEAD = "  // เครื่องยนต์สายพาน: ขยับรางไปซ้าย 1 ใบด้วยความเร็วคงที่ → ยกใบแรกไปต่อท้าย → ทำซ้ำ"
TAIL = "  }, [auto, k, arm, STEP]);"
assert src.count(HEAD) == 1, "ANCHOR FAIL (engine head)"
assert src.count(TAIL) == 1, "ANCHOR FAIL (engine tail)"
i = src.index(HEAD)
j = src.index(TAIL) + len(TAIL)
assert i < j, "ANCHOR FAIL (head อยู่หลัง tail?)"

ENGINE = """  // เครื่องยนต์สายพาน v7.1: ทุกงานขยับราง/สลับการ์ดเกิด "ก่อนจอวาด" (useLayoutEffect)
  // - ครบ 1 ใบ: setK ใน transitionend → React commit ใหม่ → effect นี้ reset รางก่อน paint = ภาพต่อเนื่องเป๊ะ (แก้กระตุกเดิม)
  // - ผู้ใช้เลื่อนค้าง: ไม่ม้วนกลับหัวแถวแล้ว — ดูดซับใบเต็มเข้า k + หักออกจาก scrollLeft ในเฟรมเดียว → วิ่งต่อจากจุดค้าง
  useIsoLayoutEffect(() => {
    if (!auto) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = boxRef.current, tr = trackRef.current; if (!el || !tr) return;
    if (pausedRef.current) return;
    let cancelled = false;

    // ดูดซับระยะที่ผู้ใช้เลื่อนค้าง (ทำคู่ setK ก่อนจอวาด — ภาพเดิมเป๊ะ ไม่กระโดด)
    const c = Math.floor(el.scrollLeft / STEP);
    if (c > 0) {
      el.scrollLeft = el.scrollLeft - c * STEP;
      setK(v => (v + c) % N); // effect รอบใหม่จะ run ต่อเองจากเศษที่เหลือ
      return;
    }

    const run = () => {
      if (cancelled || pausedRef.current) return;
      tr.style.transition = "none"; tr.style.transform = "translateX(0)";
      void tr.offsetWidth; // บังคับเบราว์เซอร์รับค่าก่อนเริ่มไหล
      tr.style.transition = `transform ${(STEP / 20).toFixed(2)}s linear`;
      tr.style.transform = `translateX(-${STEP}px)`;
    };
    const onEnd = (e) => {
      if (e.propertyName !== "transform" || cancelled || pausedRef.current) return;
      setK(v => (v + 1) % N); // หมุนสายพาน 1 ใบ — effect รอบใหม่ reset รางก่อนจอวาด
    };
    tr.addEventListener("transitionend", onEnd);
    run();

    return () => {
      cancelled = true;
      tr.removeEventListener("transitionend", onEnd);
    };
  }, [auto, k, arm, STEP]);"""

if crlf:
    ENGINE = ENGINE.replace("\n", "\r\n")

src = src[:i] + ENGINE + src[j:]

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: CatSlider.js → v7.1 (หายกระตุก + วิ่งต่อจากจุดค้าง) · CRLF=" + str(crlf))
