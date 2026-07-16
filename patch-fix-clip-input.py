# patch-fix-clip-input.py — แก้บั๊กถาวร: ช่อง "คลิปหลักฐานยาวสุด/ใหญ่สุด" พิมพ์เลขไม่ได้
# สาเหตุเดิม: onChange clamp (num()) ทุกตัวอักษรที่พิมพ์ — พอเลขกลาง (เช่น "9" ก่อนพิมพ์ "0" ต่อ) ต่ำกว่า min(10)
# ระบบจะดีดกลับเป็น 10 ทันทีก่อนพิมพ์ตัวต่อไปทัน ทำให้พิมพ์เลขที่ขึ้นต้นด้วยหลักเดียวต่ำกว่า 10 ไม่ได้เลย
# ทางแก้: พิมพ์ได้อิสระ (เก็บ string ดิบ) แล้วค่อย clamp ตอนออกจากช่อง (onBlur) — backend ยังคลัมป์ซ้ำอยู่แล้วเป็นเซฟตี้ชั้นสอง
# รัน: python patch-fix-clip-input.py
# แก้ไฟล์: app/admin/AdminClient.js
import sys

PATH = "app/admin/AdminClient.js"
MARKER = "FIX-CLIP-INPUT-BLUR"

def eol_of(text):
    return "\r\n" if "\r\n" in text else "\n"

def apply_one(text, old, new, label):
    n = text.count(old)
    assert n == 1, f"[FAIL] anchor ไม่ unique หรือหาไม่เจอ ({label}) — เจอ {n} จุด ต้องเจอ 1 จุดเท่านั้น"
    print(f"[OK] {label}")
    return text.replace(old, new, 1)

with open(PATH, encoding="utf-8", newline="") as f:
    text = f.read()

if MARKER in text:
    print(f"[SKIP] เจอ marker '{MARKER}' อยู่แล้ว — patch นี้รันไปแล้ว ไม่ทำซ้ำ")
    sys.exit(0)

# ---- 1) คลิปหลักฐานยาวสุด (วินาที) ----
old1 = '<input type="number" value={draft.dispute_clip_max_sec} onChange={e => set({ dispute_clip_max_sec: num(e.target.value, 10, 300) })} style={inputS} />'
new1 = f'<input type="number" value={{draft.dispute_clip_max_sec}} onChange={{e => set({{ dispute_clip_max_sec: e.target.value }})}} onBlur={{e => set({{ dispute_clip_max_sec: num(e.target.value, 10, 300) }})}} style={{inputS}} /> {{/* {MARKER} */}}'
text = apply_one(text, old1, new1, "1/2 คลิปหลักฐานยาวสุด (วินาที)")

# ---- 2) คลิปหลักฐานใหญ่สุด (MB) ----
old2 = '<input type="number" value={draft.dispute_clip_max_mb} onChange={e => set({ dispute_clip_max_mb: num(e.target.value, 10, 500) })} style={inputS} />'
new2 = f'<input type="number" value={{draft.dispute_clip_max_mb}} onChange={{e => set({{ dispute_clip_max_mb: e.target.value }})}} onBlur={{e => set({{ dispute_clip_max_mb: num(e.target.value, 10, 500) }})}} style={{inputS}} /> {{/* {MARKER} */}}'
text = apply_one(text, old2, new2, "2/2 คลิปหลักฐานใหญ่สุด (MB)")

with open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("\n========== เสร็จ: แก้บั๊ก input คลิป config ==========")
