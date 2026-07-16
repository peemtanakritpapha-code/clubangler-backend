# patch-dispute2b-orderview-fix.py — แก้ของที่ผมพลาดลืมทำใน DISPUTE-2b รอบแรก
# ตอนนั้น patch เฉพาะหน้าแอดมิน 2 จุด แต่ลืมหน้าออเดอร์ฝั่งผู้ใช้ (ผู้ซื้อ/ผู้ขายเห็นเอง) 1 จุด
# รัน: python patch-dispute2b-orderview-fix.py
# แก้ไฟล์: app/orders/[id]/OrderDetailClient.js
import sys

PATH = "app/orders/[id]/OrderDetailClient.js"
MARKER = "DISPUTE-2b-CLIP-ORDERVIEW"

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

E = eol_of(text)

old = E.join([
    '              {(o.evidence_paths || []).length > 0 && (',
    '                <>',
    '                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>หลักฐานที่{isSeller ? "ผู้ซื้อ" : "คุณ"}แนบ ({o.evidence_paths.length}) — กดเพื่อขยาย</div>',
    '                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>',
    '                    {o.evidence_paths.map((u, i) => (',
    '                      <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} /></a>',
    '                    ))}',
    '                  </div>',
    '                </>',
    '              )}',
])
new = old + E + E.join([
    f'              {{/* {MARKER}: จุดที่ผมลืม patch รอบแรก — คลิปเปิดกล่องที่ผู้ซื้อแนบ */}}',
    '              {o.evidence_video_path && (',
    '                <>',
    '                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>คลิปเปิดกล่องที่{isSeller ? "ผู้ซื้อ" : "คุณ"}แนบ</div>',
    '                  <video src={o.evidence_video_path} controls style={{ width: 200, borderRadius: 8, border: `1px solid ${C.line}`, marginTop: 4, display: "block" }} />',
    '                </>',
    '              )}',
])
text = apply_one(text, old, new, "1/1 เพิ่มการแสดงคลิปในหน้าออเดอร์ฝั่งผู้ใช้")

with open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("\n========== เสร็จ: แก้จุดที่ลืม (orderview) ==========")
