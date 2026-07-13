# patch-reel3b.py — REEL-3b (13 ก.ค. 2569): เปิดช่อง "ย่อหน้าแนะนำ" ให้หน้าหมวดย่อยรอกด้วย
#   SeoPanel เดิมเปิดช่องนี้เฉพาะคีย์ cat: (ตอนสร้างยังไม่มี sub:) → 3 หน้าใหม่เลยไม่เห็นช่อง
# รัน:  python patch-reel3b.py   (รันซ้ำได้)
import io

path = "app/admin/SeoPanel.js"
with io.open(path, "r", encoding="utf-8", newline="") as f:
    src = f.read()
marker = 'startsWith("sub:")'
if marker in src:
    print("SKIP — แก้ไปแล้ว")
else:
    anchor = 'const isCat = cur.key.startsWith("cat:");'
    n = src.count(anchor)
    assert n == 1, "FAIL: anchor พบ " + str(n) + " ครั้ง (ต้อง 1) — แคปข้อความนี้ส่ง AI"
    src = src.replace(anchor, 'const isCat = cur.key.startsWith("cat:") || cur.key.startsWith("sub:"); // REEL-3b: หน้าหมวดย่อยรอกก็มีย่อหน้าแนะนำ')
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(src)
    print("OK — ช่องย่อหน้าแนะนำเปิดให้หน้า sub แล้ว")
