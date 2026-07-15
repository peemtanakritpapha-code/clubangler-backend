# patch-config-dispute.py — CONFIG-DISPUTE
# เพิ่มค่าตั้ง 3 ตัว (อายุคลิปเคส / คลิปยาวสุด / คลิปใหญ่สุด) เข้า whitelist API + หน้าตั้งค่าแอดมิน
# รันจาก root ของ repo: python patch-config-dispute.py
# กติกา: single-line anchor + assert count == 1 + marker กันรันซ้ำ + คง CRLF
import io, sys

MARKER = "CONFIG-DISPUTE"
CRLF = "\r\n"

def read(path):
    with io.open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()

def write(path, src):
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(src)

def insert_after_line(src, anchor, addition, path):
    n = src.count(anchor)
    assert n == 1, "ANCHOR ERROR in %s: found %d of %r (need 1) — STOP" % (path, n, anchor[:50])
    i = src.index(anchor)
    le = src.index(CRLF, i) + 2
    return src[:le] + addition + src[le:]

def assert_balanced(text, path):
    for a, b in [("(", ")"), ("{", "}"), ("[", "]")]:
        assert text.count(a) == text.count(b), "BALANCE ERROR in inserted text for %s: %s%s — STOP" % (path, a, b)

# ---------- ไฟล์ A: app/api/admin/platform-config/route.js ----------
PA = "app/api/admin/platform-config/route.js"
sa = read(PA)
if MARKER in sa:
    print("SKIP A: %s ถูก patch แล้ว" % PA)
else:
    addA1 = '  "dispute_video_retention_days", "dispute_clip_max_sec", "dispute_clip_max_mb", // CONFIG-DISPUTE' + CRLF
    sa = insert_after_line(sa, '"ai_notes", // AI2:', addA1, PA)

    addA2 = (
        '  if ("dispute_video_retention_days" in patch) patch.dispute_video_retention_days = Math.min(365, Math.max(1, Number(patch.dispute_video_retention_days) || 0)); // CONFIG-DISPUTE' + CRLF +
        '  if ("dispute_clip_max_sec" in patch) patch.dispute_clip_max_sec = Math.min(300, Math.max(10, Number(patch.dispute_clip_max_sec) || 0));' + CRLF +
        '  if ("dispute_clip_max_mb" in patch) patch.dispute_clip_max_mb = Math.min(500, Math.max(10, Number(patch.dispute_clip_max_mb) || 0));' + CRLF
    )
    sa = insert_after_line(sa, 'if ("pay_within_minutes" in patch)', addA2, PA)
    assert_balanced(addA1 + addA2, PA)
    write(PA, sa)
    print("PATCHED A OK: %s (+whitelist 3 keys, +clamp 3 keys)" % PA)

# ---------- ไฟล์ B: app/admin/AdminClient.js ----------
PB = "app/admin/AdminClient.js"
sb = read(PB)
if MARKER in sb:
    print("SKIP B: %s ถูก patch แล้ว" % PB)
else:
    addB1 = (
        '    dispute_video_retention_days: Number(config?.dispute_video_retention_days) || 30, // CONFIG-DISPUTE' + CRLF +
        '    dispute_clip_max_sec: Number(config?.dispute_clip_max_sec) || 60,' + CRLF +
        '    dispute_clip_max_mb: Number(config?.dispute_clip_max_mb) || 100,' + CRLF
    )
    sb = insert_after_line(sb, 'ai_notes: config?.ai_notes || "", // AI2', addB1, PB)

    # แทรกช่อง UI 3 แถว หลังปิด </Row> ของช่อง pay_within_minutes (หาจุดปิดแบบโปรแกรม)
    anchor = "value={draft.pay_within_minutes}"
    n = sb.count(anchor)
    assert n == 1, "ANCHOR ERROR in %s: found %d of pay_within_minutes input — STOP" % (PB, n)
    i = sb.index(anchor)
    j = sb.index("</Row>", i)
    assert j - i < 300, "DISTANCE ERROR: </Row> too far from anchor (%d chars) — STOP" % (j - i)
    le = sb.index(CRLF, j) + 2

    addB2 = (
        '        <Row label="เก็บคลิปหลักฐานเคสหลังปิด (วัน)" hint="ครบกำหนด ระบบลบเฉพาะไฟล์วิดีโอของเคสที่ปิดแล้ว — รูปเก็บถาวร (CONFIG-DISPUTE)">' + CRLF +
        '          <input type="number" value={draft.dispute_video_retention_days} onChange={e => set({ dispute_video_retention_days: num(e.target.value, 1, 365) })} style={inputS} />' + CRLF +
        '        </Row>' + CRLF +
        '        <Row label="คลิปหลักฐานยาวสุด (วินาที)" hint="ด่านตรวจตอนผู้ซื้อแนบคลิปเปิดกล่องในฟอร์มเปิดเคส">' + CRLF +
        '          <input type="number" value={draft.dispute_clip_max_sec} onChange={e => set({ dispute_clip_max_sec: num(e.target.value, 10, 300) })} style={inputS} />' + CRLF +
        '        </Row>' + CRLF +
        '        <Row label="คลิปหลักฐานใหญ่สุด (MB)" hint="เกินกำหนด ระบบปฏิเสธไฟล์ตั้งแต่ก่อนอัปโหลด">' + CRLF +
        '          <input type="number" value={draft.dispute_clip_max_mb} onChange={e => set({ dispute_clip_max_mb: num(e.target.value, 10, 500) })} style={inputS} />' + CRLF +
        '        </Row>' + CRLF
    )
    sb = sb[:le] + addB2 + sb[le:]
    assert_balanced(addB1 + addB2, PB)
    write(PB, sb)
    print("PATCHED B OK: %s (+base 3 keys, +UI 3 rows)" % PB)

print("DONE — CONFIG-DISPUTE complete")
