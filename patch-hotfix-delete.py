# patch-hotfix-delete.py — HOTFIX-DELETE
# เพิ่ม "expired" เข้าสถานะออเดอร์ที่ถือว่าจบแล้ว ใน API ลบบัญชี
# (บัค: ใครมีใบสั่งซื้อหมดเวลาเก่า 1 ใบ จะลบบัญชีตัวเองไม่ได้ตลอดกาล)
# รันจาก root ของ repo: python patch-hotfix-delete.py
import sys, io

PATH = "app/api/account/delete/route.js"
MARKER = "HOTFIX-DELETE"
OLD = 'const DONE = ["completed", "refunded"]; // \u0e2a\u0e16\u0e32\u0e19\u0e30\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e16\u0e37\u0e2d\u0e27\u0e48\u0e32\u0e08\u0e1a\u0e41\u0e25\u0e49\u0e27'
NEW = 'const DONE = ["completed", "refunded", "expired"]; // \u0e2a\u0e16\u0e32\u0e19\u0e30\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e16\u0e37\u0e2d\u0e27\u0e48\u0e32\u0e08\u0e1a\u0e41\u0e25\u0e49\u0e27 (expired \u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e07\u0e34\u0e19/\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e1e\u0e31\u0e27\u0e1e\u0e31\u0e19 \u2014 HOTFIX-DELETE)'

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

if MARKER in src:
    print("SKIP: \u0e44\u0e1f\u0e25\u0e4c\u0e16\u0e39\u0e01 patch \u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27 (\u0e40\u0e08\u0e2d marker) \u2014 \u0e44\u0e21\u0e48\u0e17\u0e33\u0e0b\u0e49\u0e33")
    sys.exit(0)

count = src.count(OLD)
assert count == 1, "ANCHOR ERROR: \u0e1e\u0e1a %d \u0e08\u0e38\u0e14 (\u0e15\u0e49\u0e2d\u0e07 = 1) \u2014 \u0e2b\u0e22\u0e38\u0e14! \u0e2d\u0e22\u0e48\u0e32\u0e44\u0e1b\u0e15\u0e48\u0e2d \u0e41\u0e08\u0e49\u0e07 Claude" % count

src = src.replace(OLD, NEW)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("PATCHED OK: app/api/account/delete/route.js \u2014 DONE \u0e23\u0e27\u0e21 expired \u0e41\u0e25\u0e49\u0e27")
