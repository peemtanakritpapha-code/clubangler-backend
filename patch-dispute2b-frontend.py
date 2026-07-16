# patch-dispute2b-frontend.py — DISPUTE-2b: เพิ่มฟอร์มบังคับแนบคลิปเปิดกล่องใน DisputeModal
# รัน: python patch-dispute2b-frontend.py
# แก้ไฟล์: app/orders/[id]/OrderDetailClient.js
import sys

PATH = "app/orders/[id]/OrderDetailClient.js"
MARKER = "DISPUTE-2b-CLIP"  # anti-rerun marker

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

# ---- 1) เพิ่ม config prop ให้ DisputeModal ----
text = apply_one(
    text,
    'function DisputeModal({ order, userId, onClose, onDone, returnDays }) { // CONSENT-1: returnDays = จุดที่ 4',
    f'function DisputeModal({{ order, userId, onClose, onDone, returnDays, config }}) {{ // CONSENT-1: returnDays = จุดที่ 4 · {MARKER}: config = เพดานคลิป',
    "1/8 เพิ่ม config prop",
)

# ---- 2) เพิ่ม state คลิป + ค่าเพดานจาก config ----
# สำคัญ: ต้องประกาศ `clip` (useState) มาก่อนบรรทัด dOk เพราะ dOk เรียกใช้ clip.valid
# ในไฟล์เดิม dOk อยู่ก่อน returnConfirm อยู่แล้ว เลยรวม edit นี้กับ dOk (ข้อ 4) เป็นก้อนเดียวกัน
# เพื่อกันปัญหา temporal dead zone (ประกาศ const หลังจุดที่ถูกเรียกใช้ในสโคปเดียวกัน)
old2 = E.join([
    '  const [err, setErr] = useState("");',
    '  const dOk = dF.reason && dF.detail.trim() && dF.files.length > 0;',
    '  const [returnConfirm, setReturnConfirm] = useState(false); // CONSENT-1: จุดที่ 4',
])
new2 = E.join([
    '  const [err, setErr] = useState("");',
    f'  const [clip, setClip] = useState({{ file: null, preview: null, valid: false, msg: "" }}); // {MARKER}',
    '  const CLIP_MAX_SEC = Number(config?.dispute_clip_max_sec) || 60;',
    '  const CLIP_MAX_MB = Number(config?.dispute_clip_max_mb) || 100;',
    f'  const dOk = dF.reason && dF.detail.trim() && dF.files.length > 0 && clip.valid; // {MARKER}',
    '  const [returnConfirm, setReturnConfirm] = useState(false); // CONSENT-1: จุดที่ 4',
])
text = apply_one(text, old2, new2, "2/8 เพิ่ม state คลิป + เพดาน config + แก้ dOk (รวมกันกันลำดับ declaration พัง)")

# ---- 3) เพิ่มฟังก์ชัน addClip / removeClip ต่อจาก removePhoto ----
old3 = E.join([
    '  const removePhoto = i => {',
    '    const files = dF.files.filter((_, j) => j !== i);',
    '    setDF(f => { f.previews.forEach(u => URL.revokeObjectURL(u)); return { ...f, files, previews: files.map(x => URL.createObjectURL(x)) }; });',
    '  };',
])
new3 = old3 + E + E.join([
    f'  // {MARKER}: เลือกคลิป 1 ไฟล์ → เช็คขนาดทันที + เช็คความยาวหลังโหลด metadata',
    '  const addClip = e => {',
    '    const f = e.target.files?.[0];',
    '    e.target.value = "";',
    '    if (!f) return;',
    '    if (clip.preview) URL.revokeObjectURL(clip.preview);',
    '    const url = URL.createObjectURL(f);',
    '    const sizeMb = f.size / (1024 * 1024);',
    '    if (sizeMb > CLIP_MAX_MB) {',
    '      setClip({ file: null, preview: null, valid: false, msg: `ไฟล์ใหญ่เกิน ${CLIP_MAX_MB}MB (ไฟล์นี้ ${sizeMb.toFixed(1)}MB) — เลือกคลิปใหม่` });',
    '      return;',
    '    }',
    '    const v = document.createElement("video");',
    '    v.preload = "metadata";',
    '    v.onloadedmetadata = () => {',
    '      if (v.duration > CLIP_MAX_SEC) {',
    '        setClip({ file: null, preview: null, valid: false, msg: `คลิปยาวเกิน ${CLIP_MAX_SEC} วินาที (คลิปนี้ ${Math.round(v.duration)} วิ) — ตัดให้สั้นลง` });',
    '      } else {',
    '        setClip({ file: f, preview: url, valid: true, msg: `${Math.round(v.duration)} วินาที · ${sizeMb.toFixed(1)}MB` });',
    '      }',
    '    };',
    '    v.onerror = () => setClip({ file: null, preview: null, valid: false, msg: "เปิดไฟล์วิดีโอนี้ไม่ได้ — ลองไฟล์อื่น" });',
    '    v.src = url;',
    '  };',
    '  const removeClip = () => {',
    '    if (clip.preview) URL.revokeObjectURL(clip.preview);',
    '    setClip({ file: null, preview: null, valid: false, msg: "" });',
    '  };',
])
text = apply_one(text, old3, new3, "3/8 เพิ่ม addClip/removeClip")

# ---- (ข้อ 4 ถูกรวมเข้ากับข้อ 2 แล้วด้านบน — ข้ามเลข 4 ไปเลย) ----

# ---- 5) doSubmit: อัปโหลดคลิปคู่กับรูป + ส่ง evidenceVideoPath ----
old5 = E.join([
    '      const res = await fetch(`/api/orders/${order.id}/dispute`, {',
    '        method: "POST", headers: { "Content-Type": "application/json" },',
    '        body: JSON.stringify({ reason: dF.reason, detail: dF.detail.trim(), requireReturn: dF.returnWant, evidencePaths: urls }),',
    '      });',
])
new5 = E.join([
    f'      // {MARKER}: อัปโหลดคลิปเปิดกล่อง (ผ่านการตรวจความยาว/ขนาดจาก addClip แล้ว)',
    '      const clipExt = (clip.file.name.split(".").pop() || "mp4").toLowerCase();',
    '      const clipPath = `order-evidence/${userId}/dispute-clip-${order.order_no}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${clipExt}`;',
    '      const { error: clipErr } = await supabase.storage.from("products").upload(clipPath, clip.file);',
    '      if (clipErr) throw clipErr;',
    '      const clipUrl = supabase.storage.from("products").getPublicUrl(clipPath).data.publicUrl;',
    '      const res = await fetch(`/api/orders/${order.id}/dispute`, {',
    '        method: "POST", headers: { "Content-Type": "application/json" },',
    '        body: JSON.stringify({ reason: dF.reason, detail: dF.detail.trim(), requireReturn: dF.returnWant, evidencePaths: urls, evidenceVideoPath: clipUrl }),',
    '      });',
])
text = apply_one(text, old5, new5, "5/8 doSubmit ส่ง evidenceVideoPath")

# ---- 6) UI: เพิ่ม section คลิปเปิดกล่อง ก่อน section โหมดคืนของ ----
old6 = '        {/* 4. โหมด: คืนของ (default) vs พิพาทไกล่เกลี่ย */}'
clip_ui = E.join([
    f'        {{/* 3.5 คลิปเปิดกล่อง — {MARKER} บังคับ 1 ไฟล์ */}}',
    '        <div>',
    '          <div style={label}>คลิปเปิดกล่อง <span style={{ color: DANGER }}>*</span> <span style={{ fontWeight: 400, color: C.muted }}>(1 คลิป ไม่เกิน {CLIP_MAX_SEC} วินาที ไม่เกิน {CLIP_MAX_MB}MB)</span></div>',
    '          {!clip.file ? (',
    '            <>',
    '              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, width: "100%", height: 64, border: `1.5px dashed ${C.line}`, borderRadius: 10, color: C.muted, cursor: "pointer" }}>',
    '                <span style={{ fontSize: 20 }}>🎬</span>',
    '                <span style={{ fontSize: 11.5, fontWeight: 600 }}>แตะเพื่อเลือกวิดีโอ</span>',
    '                <input type="file" accept="video/*" onChange={addClip} style={{ display: "none" }} />',
    '              </label>',
    '              {clip.msg && <div style={{ fontSize: 11.5, color: DANGER, marginTop: 6 }}>✕ {clip.msg}</div>}',
    '            </>',
    '          ) : (',
    '            <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: 8 }}>',
    '              <video src={clip.preview} muted style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 7, background: "#000" }} />',
    '              <div style={{ flex: 1, minWidth: 0 }}>',
    '                <div style={{ fontSize: 12, fontWeight: 700, color: C.ok }}>✓ ใช้ได้ — {clip.msg}</div>',
    '                <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clip.file.name}</div>',
    '              </div>',
    '              <span onClick={removeClip} style={{ width: 24, height: 24, borderRadius: "50%", background: DANGER, color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>✕</span>',
    '            </div>',
    '          )}',
    '          <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>📌 ถ่ายตั้งแต่ยังไม่แกะกล่อง ให้เห็นสภาพกล่อง/เทปรอบด้านก่อนเปิด — หลักฐานสำคัญที่สุดกรณีของไม่ตรงปก</div>',
    '        </div>',
    '',
    old6,
])
text = apply_one(text, old6, clip_ui, "6/8 เพิ่ม UI section คลิป")

# ---- 7) ข้อความปุ่มตอนยังกรอกไม่ครบ ----
text = apply_one(
    text,
    '{busy ? "กำลังส่ง..." : dOk ? (dF.returnWant ? "ส่งคำขอคืนสินค้า" : "ยืนยันเปิดข้อพิพาท") : "เลือกเหตุผล + กรอกรายละเอียด + แนบรูปอย่างน้อย 1"}',
    '{busy ? "กำลังส่ง..." : dOk ? (dF.returnWant ? "ส่งคำขอคืนสินค้า" : "ยืนยันเปิดข้อพิพาท") : "เลือกเหตุผล + รายละเอียด + รูป + คลิปเปิดกล่องให้ครบ"}',
    "7/8 ข้อความปุ่ม disabled",
)

# ---- 8) ส่ง config prop ตอน render DisputeModal ----
text = apply_one(
    text,
    '{dispute && <DisputeModal order={o} userId={userId} returnDays={Y_DAYS} onClose={() => setDispute(false)} /* CONSENT-1: จุดที่ 4 */',
    f'{{dispute && <DisputeModal order={{o}} userId={{userId}} returnDays={{Y_DAYS}} config={{config}} onClose={{() => setDispute(false)}} /* CONSENT-1: จุดที่ 4 · {MARKER}: ส่ง config ไปคำนวณเพดานคลิป */',
    "8/8 ส่ง config ให้ DisputeModal",
)

with open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("\n========== เสร็จ: DISPUTE-2b frontend ==========")
