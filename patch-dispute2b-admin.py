# patch-dispute2b-admin.py — DISPUTE-2b: หน้าแอดมินโชว์คลิปเปิดกล่องคู่กับรูปหลักฐาน (2 จุด)
# รัน: python patch-dispute2b-admin.py
# แก้ไฟล์: app/admin/AdminClient.js
import sys

PATH = "app/admin/AdminClient.js"
MARKER = "DISPUTE-2b-CLIP"

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

# ---- 1) จุดที่ 1: การ์ดในลิสต์เคส (photo 64x64) ----
old1 = E.join([
    '                {(o.evidence_paths || []).length > 0 && (',
    '                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>',
    '                    {o.evidence_paths.map((u, i) => (',
    '                      <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} /></a>',
    '                    ))}',
    '                  </div>',
    '                )}',
])
new1 = old1 + E + E.join([
    f'                {{/* {MARKER} */}}',
    '                {o.evidence_video_path && (',
    '                  <video src={o.evidence_video_path} controls style={{ width: 160, borderRadius: 8, border: `1px solid ${C.line}`, marginTop: 6, display: "block" }} />',
    '                )}',
])
text = apply_one(text, old1, new1, "1/2 จุดลิสต์เคส (การ์ด 64x64)")

# ---- 2) จุดที่ 2: หน้ารายละเอียดเคส (photo 52x52) ----
old2 = E.join([
    '                  {(o.evidence_paths || []).length > 0 && (',
    '                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>',
    '                      {o.evidence_paths.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} /></a>)}',
    '                    </div>',
    '                  )}',
])
new2 = old2 + E + E.join([
    f'                  {{/* {MARKER} */}}',
    '                  {o.evidence_video_path && (',
    '                    <video src={o.evidence_video_path} controls style={{ width: 140, borderRadius: 8, border: `1px solid ${C.line}`, marginTop: 6, display: "block" }} />',
    '                  )}',
])
text = apply_one(text, old2, new2, "2/2 จุดรายละเอียดเคส (การ์ด 52x52)")

with open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("\n========== เสร็จ: DISPUTE-2b admin ==========")
