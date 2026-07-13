# patch-reel1-fix2.py — REEL-1 FIX2 (13 ก.ค. 2569): ตัวกรองหน้า sub ต้องเจาะลึกถึงประเภทรอกเลย
#   [1] app/market/MarketClient.js — เพิ่ม prop "basePath": เส้นทางฐานของตัวกรอง
#       (หน้าเดิมทั้งหมดไม่ส่ง prop นี้ = พฤติกรรมเดิมเป๊ะ ไม่กระทบ /market และหน้าหมวด)
#   [2] app/market/[cat]/[sub]/page.js — ส่ง basePath = [รอกตกปลา, ประเภทรอกของหน้านั้น]
#       ผล: กล่องหมวดย่อยขึ้น "รอกตกปลา › รอกสปินนิ่ง" ทันทีที่เข้าหน้า + ถอยต่ำกว่านี้ไม่ได้
# รัน:  python patch-reel1-fix2.py   (รันซ้ำได้ จุดที่แก้แล้วจะข้ามเอง)
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

# ── [1] MarketClient: รับ basePath ──
patch(
    "app/market/MarketClient.js",
    [
        (
            'hideCat = false, searchCat = "" }) { // SEO-5c',
            'hideCat = false, searchCat = "", basePath = null }) { // SEO-5c · REEL-1FIX2: basePath = เส้นทางฐานตัวกรอง (หน้า sub ส่งมา)',
        ),
        (
            "const MINP = hideCat && searchCat ? [searchCat] : []; // SEO-5f",
            "const MINP = basePath || (hideCat && searchCat ? [searchCat] : []); // SEO-5f · REEL-1FIX2",
        ),
    ],
    "REEL-1FIX2: basePath",
    "[1] MarketClient.js — prop basePath",
)

# ── [2] หน้า sub: ส่ง basePath ลึกถึงประเภทรอก ──
patch(
    "app/market/[cat]/[sub]/page.js",
    [(
        "hideCat searchCat={REEL_CAT} />",
        "hideCat searchCat={REEL_CAT} basePath={[REEL_CAT, r.sub]} /> {/* REEL-1FIX2: ตัวกรองเริ่มลึกถึงประเภทรอกของหน้านี้ */}",
    )],
    "REEL-1FIX2: ตัวกรอง",
    "[2] page.js — ส่ง basePath",
)

print("Done — เปิด dev แล้วเข้าหน้า sub ใหม่ กล่องหมวดย่อยต้องขึ้นชื่อประเภทรอกทันที")
