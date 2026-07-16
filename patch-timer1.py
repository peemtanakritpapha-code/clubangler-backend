# patch-timer1.py — TIMER-1: แจ้งเตือน 2 จังหวะ (ก่อนยืนยันรับแทนผู้ซื้อ) + ลบ snapshot ใบ expired/cancelled
# สำคัญ: แก้แบบ "เพิ่มโค้ดใหม่" เท่านั้น ไม่แตะ/ไม่แก้ logic เดิมของ A-F ที่ทำงานอยู่แล้ว (คุมความเสี่ยงกับเงินจริง)
# รัน: python patch-timer1.py
# แก้ไฟล์: app/api/cron/auto-confirm/route.js
import sys

PATH = "app/api/cron/auto-confirm/route.js"
MARKER = "TIMER-1"

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

# ---- 1) เพิ่ม counter ใหม่ใน result (ไม่แตะของเดิม แค่ต่อท้าย) ----
old1 = '  const result = { stamped: 0, buyer_confirmed: [], seller_received: [], return_expired: [], cancelled: [], expired: [], slip_expired: [] };'
new1 = f'  const result = {{ stamped: 0, buyer_confirmed: [], seller_received: [], return_expired: [], cancelled: [], expired: [], slip_expired: [], reminders_day3: [], reminders_24h: [], snapshot_cleared: 0 }}; // {MARKER}'
text = apply_one(text, old1, new1, "1/3 เพิ่ม counter ใหม่ใน result")

# ---- 2) แทรกบล็อกแจ้งเตือน 2 จังหวะ — ก่อนส่วน B เดิม (ไม่แก้ A เดิมเลย แค่แทรกก่อนหน้า B) ----
anchor2 = '  /* ── B) ครบ M วันหลังส่งคืน → ยืนยันรับของคืนแทนผู้ขาย ── */'
remind_block = E.join([
    f'  /* ── {MARKER}: แจ้งเตือน 2 จังหวะ ก่อนระบบยืนยันรับแทนผู้ซื้อ (กันเซอร์ไพรส์ — ไม่แก้ logic เดิมของ A) ── */',
    '  const { data: candRemind } = await admin.from("orders")',
    '    .select("id, order_no, item, buyer_id, shipped_at, extend_status, extend_days, reminder_day3_sent, reminder_24h_sent")',
    '    .eq("status", "shipped").not("shipped_at", "is", null)',
    '    .or("reminder_day3_sent.eq.false,reminder_24h_sent.eq.false").limit(300);',
    '  for (const o of candRemind || []) {',
    '    if (o.extend_status === "pending") continue; // รอผู้ขายตอบคำขอขยาย — พักแจ้งเตือนไว้ก่อนเหมือนกัน',
    '    const extra = o.extend_status === "approved" ? (Number(o.extend_days) || 0) : 0;',
    '    const shippedMs = new Date(o.shipped_at).getTime();',
    '    const deadlineMs = shippedMs + daysMs(N + extra);',
    '    const elapsedMs = now - shippedMs;',
    '',
    '    if (!o.reminder_day3_sent && N > 3 && elapsedMs >= daysMs(3)) {',
    '      await admin.from("notifications").insert([',
    '        { to_user: o.buyer_id, icon: "🔔", title: "อย่าลืมตรวจสอบสินค้า", body: `${o.item} — เหลืออีก ${Math.max(0, N + extra - 3)} วัน ระบบจะยืนยันรับแทนถ้าไม่แจ้งปัญหาก่อน`, ref: o.order_no },',
    '      ]);',
    '      await admin.from("orders").update({ reminder_day3_sent: true }).eq("id", o.id);',
    '      result.reminders_day3.push(o.order_no);',
    '    }',
    '    if (!o.reminder_24h_sent && now >= deadlineMs - 24 * 3600000) {',
    '      await admin.from("notifications").insert([',
    '        { to_user: o.buyer_id, icon: "⏰", title: "เหลือเวลาอีก 24 ชม.", body: `${o.item} — ระบบจะยืนยันรับสินค้าแทนคุณใน 24 ชม. หากพบปัญหากดแจ้งได้ก่อนถึงเวลา`, ref: o.order_no },',
    '      ]);',
    '      await admin.from("orders").update({ reminder_24h_sent: true }).eq("id", o.id);',
    '      result.reminders_24h.push(o.order_no);',
    '    }',
    '  }',
    '',
    anchor2,
])
text = apply_one(text, anchor2, remind_block, "2/3 แทรกแจ้งเตือน 2 จังหวะ")

# ---- 3) แทรกบล็อกลบ snapshot ใบ expired/cancelled — ก่อนสรุปแจ้งแอดมิน (AD5) ----
anchor3 = '  // AD5: สรุปแจ้งแอดมิน — เฉพาะรอบที่มีงานเกิด'
snap_block = E.join([
    f'  /* ── {MARKER}: ลบ snapshot ของใบที่ปิดแบบไม่มีทางเปิดข้อพิพาทได้อีก (expired/cancelled) ── */',
    '  const { data: snapRows } = await admin.from("orders")',
    '    .select("id").in("status", ["expired", "cancelled"]).not("product_snapshot", "is", null).limit(500);',
    '  if (snapRows?.length) {',
    '    await admin.from("orders").update({ product_snapshot: null }).in("id", snapRows.map(x => x.id));',
    '    result.snapshot_cleared = snapRows.length;',
    '  }',
    '',
    anchor3,
])
text = apply_one(text, anchor3, snap_block, "3/3 แทรกลบ snapshot expired/cancelled")

with open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("\n========== เสร็จ: TIMER-1 ==========")
