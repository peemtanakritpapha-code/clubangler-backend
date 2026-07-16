# patch-dispute2b-backend.py — DISPUTE-2b: backend รับ+บังคับ evidenceVideoPath
# รัน: python patch-dispute2b-backend.py
# แก้ไฟล์: app/api/orders/[id]/dispute/route.js
import sys

PATH = "app/api/orders/[id]/dispute/route.js"
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

# ---- 1) รับ evidenceVideoPath + บังคับต้องมีค่า ----
old1 = E.join([
    '  const { reason, detail, requireReturn, evidencePaths } = await req.json();',
    '  if (!reason) return NextResponse.json({ error: "เลือกเหตุผล" }, { status: 400 });',
    '  if (!String(detail || "").trim()) return NextResponse.json({ error: "กรอกคำอธิบายปัญหา (บังคับ)" }, { status: 400 });',
    '  if (!Array.isArray(evidencePaths) || evidencePaths.length < 1)',
    '    return NextResponse.json({ error: "แนบรูปหลักฐานอย่างน้อย 1 รูป" }, { status: 400 });',
])
new1 = E.join([
    '  const { reason, detail, requireReturn, evidencePaths, evidenceVideoPath } = await req.json();',
    '  if (!reason) return NextResponse.json({ error: "เลือกเหตุผล" }, { status: 400 });',
    '  if (!String(detail || "").trim()) return NextResponse.json({ error: "กรอกคำอธิบายปัญหา (บังคับ)" }, { status: 400 });',
    '  if (!Array.isArray(evidencePaths) || evidencePaths.length < 1)',
    '    return NextResponse.json({ error: "แนบรูปหลักฐานอย่างน้อย 1 รูป" }, { status: 400 });',
    f'  if (!String(evidenceVideoPath || "").trim()) // {MARKER}',
    '    return NextResponse.json({ error: "แนบคลิปเปิดกล่องอย่างน้อย 1 คลิป" }, { status: 400 });',
])
text = apply_one(text, old1, new1, "1/2 รับ+บังคับ evidenceVideoPath")

# ---- 2) เขียนลงตาราง orders ----
old2 = E.join([
    '  const { data: upd, error } = await admin.from("orders").update({',
    '    status, dispute_reason: reason, dispute_detail: detail.trim(),',
    '    require_return: !!requireReturn, evidence_paths: evidencePaths.slice(0, 5),',
    '  }).eq("id", id).in("status", ["shipped", "delivered"]).select("id"); // กันชน: ชนกับการโอนเงิน/ปิดออเดอร์',
])
new2 = E.join([
    '  const { data: upd, error } = await admin.from("orders").update({',
    '    status, dispute_reason: reason, dispute_detail: detail.trim(),',
    '    require_return: !!requireReturn, evidence_paths: evidencePaths.slice(0, 5),',
    f'    evidence_video_path: evidenceVideoPath.trim(), // {MARKER}',
    '  }).eq("id", id).in("status", ["shipped", "delivered"]).select("id"); // กันชน: ชนกับการโอนเงิน/ปิดออเดอร์',
])
text = apply_one(text, old2, new2, "2/2 เขียน evidence_video_path ลงตาราง")

with open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("\n========== เสร็จ: DISPUTE-2b backend ==========")
