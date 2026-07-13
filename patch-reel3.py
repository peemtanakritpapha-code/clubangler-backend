# patch-reel3.py — REEL-3 (13 ก.ค. 2569): เดินท่อ SEO ให้หน้าหมวดย่อยรอก 3 หน้า
#   [1] app/admin/SeoPanel.js — เพิ่ม 3 หน้าเข้าแท็บ SEO (คีย์ sub:รอกตกปลา/<slug>)
#   [2] app/sitemap.js — เพิ่ม 3 URL (priority 0.8 เท่าหน้าหมวด)
#   [3] app/llms.txt/route.js — เพิ่ม 3 บรรทัดใต้ "## หมวดหมู่สินค้า"
#   * API seo-pages ไม่ต้องแก้ — ตรวจแล้วไม่ล็อกรายชื่อคีย์ *
# รัน:  python patch-reel3.py   (รันซ้ำได้ จุดที่แก้แล้วจะข้ามเอง)
import io

def patch(path, jobs, done_marker, name):
    with io.open(path, "r", encoding="utf-8", newline="") as f:
        src = f.read()
    if done_marker in src:
        print("SKIP " + name + " (แก้ไปแล้ว)")
        return
    for anchor, repl in jobs:
        n = src.count(anchor)
        assert n == 1, "FAIL " + name + ": anchor พบ " + str(n) + " ครั้ง (ต้อง 1) — หยุด แคปข้อความนี้ส่ง AI:\n" + anchor
        src = src.replace(anchor, repl)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(src)
    print("OK   " + name)

IMP = 'import { REEL_CAT, REEL_SUBS } from "@/lib/reelSubs"; // REEL-3'

# ── [1] SeoPanel: เพิ่ม 3 หน้าเข้ารายการ ──
patch(
    "app/admin/SeoPanel.js",
    [
        (
            'import { CAT_MAINS } from "@/lib/catalog";',
            'import { CAT_MAINS } from "@/lib/catalog";\r\n' + IMP,
        ),
        (
            "  ...CAT_MAINS.map(c => ({ key: `cat:${c}`, name: c, url: `/market/${c}` })),",
            "  ...CAT_MAINS.map(c => ({ key: `cat:${c}`, name: c, url: `/market/${c}` })),\r\n"
            "  ...REEL_SUBS.map(r => ({ key: `sub:${REEL_CAT}/${r.slug}`, name: r.label, url: `/market/${REEL_CAT}/${r.slug}` })), // REEL-3: หน้าหมวดย่อยรอก",
        ),
    ],
    "REEL-3: หน้าหมวดย่อยรอก",
    "[1] SeoPanel.js — เพิ่ม 3 หน้า",
)

# ── [2] sitemap: เพิ่ม 3 URL ──
patch(
    "app/sitemap.js",
    [
        (
            'import { CAT_MAINS } from "@/lib/catalog";',
            'import { CAT_MAINS } from "@/lib/catalog";\r\n' + IMP,
        ),
        (
            "  let productPages = [];",
            "  // REEL-3: หน้าหมวดย่อยรอก 3 หน้า — น้ำหนักเท่าหน้าหมวด\r\n"
            "  const reelPages = REEL_SUBS.map(r => ({\r\n"
            "    url: `${BASE}/market/${encodeURIComponent(REEL_CAT)}/${encodeURIComponent(r.slug)}`,\r\n"
            '    changeFrequency: "daily",\r\n'
            "    priority: 0.8,\r\n"
            "  }));\r\n"
            "\r\n"
            "  let productPages = [];",
        ),
        (
            "  return [...staticPages, ...categoryPages, ...productPages, ...soldPages];",
            "  return [...staticPages, ...categoryPages, ...reelPages, ...productPages, ...soldPages];",
        ),
    ],
    "REEL-3: หน้าหมวดย่อยรอก",
    "[2] sitemap.js — เพิ่ม 3 URL",
)

# ── [3] llms.txt: เพิ่ม 3 บรรทัด ──
patch(
    "app/llms.txt/route.js",
    [
        (
            'import { CAT_MAINS } from "@/lib/catalog";',
            'import { CAT_MAINS } from "@/lib/catalog";\r\n' + IMP,
        ),
        (
            "    ...cats.map(c => `- [${c} มือสอง](${BASE}/market/${encodeURIComponent(c)}): ประกาศขาย${c} มือสองและมือหนึ่ง ระบุเกรดสภาพทุกชิ้น`),",
            "    ...cats.map(c => `- [${c} มือสอง](${BASE}/market/${encodeURIComponent(c)}): ประกาศขาย${c} มือสองและมือหนึ่ง ระบุเกรดสภาพทุกชิ้น`),\r\n"
            "    ...REEL_SUBS.map(r => `- [${r.label} มือสอง](${BASE}/market/${encodeURIComponent(REEL_CAT)}/${encodeURIComponent(r.slug)}): ประกาศขาย${r.label} มือสองและมือหนึ่ง ระบุเกรดสภาพทุกชิ้น`), // REEL-3",
        ),
    ],
    "REEL-3",
    "[3] llms.txt — เพิ่ม 3 บรรทัด",
)

print("Done — เปิด dev: แท็บ SEO ต้องมี 3 หน้าใหม่ · /llms.txt ต้องมี 3 บรรทัดรอกใหม่")
