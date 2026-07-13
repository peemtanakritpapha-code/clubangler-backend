# patch-reel1-fix.py — REEL-1 FIX (13 ก.ค. 2569)
#   [1] app/market/MarketClient.js — เรียงชื่อแบรนด์แบบคงที่ทุกเครื่อง
#       แก้ hydration error (เซิร์ฟเวอร์เรียง Gamakatsu ก่อน / เบราว์เซอร์เรียง G. Loomis ก่อน)
#       *** บั๊กนี้มีมาแต่เดิมทั้งเว็บ (หน้า /market ก็เป็น) ไม่ใช่ของใหม่จาก REEL-1 ***
#   [2] app/market/[cat]/[sub]/page.js — ปุ่มกลับ: "รอกตกปลาทั้งหมด" → "กลับสู่หน้าตลาด" ชี้ /market
# รัน:  python patch-reel1-fix.py   (รันซ้ำได้ จุดที่แก้แล้วจะข้ามเอง)
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

# ── [1] แก้ hydration: sort ต้องให้ผลเหมือนกันเป๊ะทั้ง server และ browser ──
patch(
    "app/market/MarketClient.js",
    [(
        ".sort((a, b) => a.localeCompare(b)), [extraBrands]); // BRAND-ADM",
        ".sort((a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }), [extraBrands]); // BRAND-ADM · REEL-1FIX: เรียงแบบคงที่ทุกเครื่อง — localeCompare เดิมให้ผล server/browser ต่างกัน = hydration error",
    )],
    "REEL-1FIX: เรียงแบบคงที่",
    "[1] MarketClient.js — sort แบรนด์ (แก้ hydration)",
)

# ── [2] ปุ่มกลับหน้า sub → กลับสู่หน้าตลาด ──
patch(
    "app/market/[cat]/[sub]/page.js",
    [
        (
            "{/* ปุ่มกลับหน้าแม่ — internal link เลี้ยง /market/รอกตกปลา ให้ยังสำคัญกับ Google */}",
            "{/* ปุ่มกลับสู่หน้าตลาด (REEL-1FIX: เคาะให้เหมือนหน้าหมวดเดิม) — ลิงก์เลี้ยงหน้าแม่ย้ายไปใส่ในย่อหน้าแนะนำแท็บ SEO (REEL-3) แทน */}",
        ),
        (
            "<Link href={`/market/${encodeURIComponent(REEL_CAT)}`} style=",
            '<Link href="/market" style=',
        ),
        (
            "<ChevronLeft size={16} />รอกตกปลาทั้งหมด",
            "<ChevronLeft size={16} />กลับสู่หน้าตลาด",
        ),
    ],
    "กลับสู่หน้าตลาด",
    "[2] page.js — ปุ่มกลับ",
)

print("Done — เปิด dev ดูหน้า sub กับหน้า /market ได้เลย (error แดงต้องหาย)")
