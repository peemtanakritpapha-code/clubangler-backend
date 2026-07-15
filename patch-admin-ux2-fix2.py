# -*- coding: utf-8 -*-
# patch-admin-ux2.py — ADMIN-UX2: อุด 3 จุดจากการใช้งานจริง
#   A) กระดิ่ง "โอนเงินไม่สำเร็จ" กดแล้วไปหน้า /kyc (บัญชีรับเงิน) — เดิมไม่มี link กดแล้วเฉย
#   B) แท็บ "คำสั่งซื้อ" ใหม่ (กลุ่มการเงิน) — ทุกสถานะ ล่าสุด 300 + ค้นหา + กรองสถานะ
#      + คลิกเปิดศูนย์ข้อมูลออเดอร์ (modal AD2 เดิม) ได้ตลอด แม้ออเดอร์พ้นคิวไปแล้ว
#   C) ปิดวงจรบัญชีรับเงิน: ย้ายบันทึกบัญชีเข้า API /api/kyc/payee (เดิม client เขียน profiles ตรง)
#      → ผู้ขายที่มีธง "โอนไม่สำเร็จ" ค้าง พอกรอกบัญชี ระบบยิงกระดิ่งหาแอดมินอัตโนมัติ "โอนซ้ำได้"
# กติกา: anchor + assert count + marker ADMIN-UX2 กันรันซ้ำ + คง CRLF + all-or-nothing
# วิธีรัน (จากโฟลเดอร์โปรเจกต์): py patch-admin-ux2.py

import io, os, sys

ROOT   = os.path.dirname(os.path.abspath(__file__))
PAYOUT = os.path.join(ROOT, "app", "api", "admin", "payout", "route.js")
PAGE   = os.path.join(ROOT, "app", "admin", "page.js")
ADMIN  = os.path.join(ROOT, "app", "admin", "AdminClient.js")
KYCC   = os.path.join(ROOT, "app", "kyc", "KycClient.js")
PAYEE_DIR  = os.path.join(ROOT, "app", "api", "kyc", "payee")
PAYEE_FILE = os.path.join(PAYEE_DIR, "route.js")

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()
def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)
def L(*lines):
    return "\r\n".join(lines)

for p in (PAYOUT, PAGE, ADMIN, KYCC):
    if "ADMIN-UX2" in read(p):
        print("SKIP: พบ marker ADMIN-UX2 ใน", os.path.relpath(p, ROOT), "— เคยรันแล้ว ไม่ทำซ้ำ"); sys.exit(0)
if os.path.exists(PAYEE_FILE):
    print("SKIP: มี app/api/kyc/payee/route.js อยู่แล้ว — เคยรันแล้ว ไม่ทำซ้ำ"); sys.exit(0)

# ═══ ไฟล์ใหม่: API บันทึกบัญชีรับเงิน ═══
PAYEE_SRC = L(
'// app/api/kyc/payee/route.js — ADMIN-UX2: บันทึกบัญชีรับเงินผ่าน API (เดิม client เขียน profiles ตรง)',
'// ปิดวงจร "โอนไม่สำเร็จ": ผู้ขายที่มีธงค้างอยู่ พออัปเดตบัญชี → แจ้งเตือนแอดมินกลับเข้าคิวโอนอัตโนมัติ',
'import { NextResponse } from "next/server";',
'import { createClient } from "@/lib/supabase/server";',
'import { createAdminClient } from "@/lib/supabase/admin";',
'import { notifyAdmins } from "@/lib/notifyAdmins";',
'',
'export async function POST(req) {',
'  const supabase = await createClient();',
'  const { data: { user } } = await supabase.auth.getUser();',
'  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });',
'',
'  const { promptpay = "", bank = null } = await req.json().catch(() => ({}));',
'  const pp = String(promptpay || "").trim() || null;',
'  const bk = bank && String(bank.no || "").trim()',
'    ? { bank: String(bank.bank || "").trim(), no: String(bank.no).trim(), name: String(bank.name || "").trim() }',
'    : null;',
'  if (!pp && !bk) return NextResponse.json({ error: "กรอกพร้อมเพย์หรือบัญชีธนาคารอย่างน้อย 1 อย่าง" }, { status: 400 });',
'',
'  const admin = createAdminClient();',
'  const { data: prof } = await admin.from("profiles").select("name, payout_failed_note").eq("id", user.id).single();',
'  const { error } = await admin.from("profiles").update({ promptpay: pp, bank: bk }).eq("id", user.id);',
'  if (error) { console.error("kyc/payee:", error); return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 }); }',
'',
'  // มีธงโอนไม่สำเร็จค้าง → เคลียร์ธงที่โปรไฟล์ (ประวัติรายออเดอร์ยังอยู่) + แจ้งแอดมินกลับเข้าคิวโอน',
'  if (prof?.payout_failed_note) {',
'    await admin.from("profiles").update({ payout_failed_note: null }).eq("id", user.id);',
'    notifyAdmins(admin, { icon: "💸", title: "ผู้ขายอัปเดตบัญชีรับเงินแล้ว — โอนซ้ำได้", body: prof?.name || "", link: "/admin?tab=payout" }).catch(() => {});',
'  }',
'  return NextResponse.json({ ok: true });',
'}',
'')

# ═══ แท็บคำสั่งซื้อทั้งหมด ═══
ALLORDERS_TAB = L(
'        {/* ── ADMIN-UX2: คำสั่งซื้อทั้งหมด — คลิกเปิดศูนย์ข้อมูลออเดอร์ (AD2 เดิม) ได้ทุกสถานะตลอดเวลา ── */}',
'        {tab === "allorders" && (() => {',
'          const AO_ST = { pending_payment: ["รอชำระ", "#B7791F"], pending_verification: ["รอตรวจสลิป", "#B45309"], payment_verified: ["ชำระแล้ว รอส่ง", C.brand], shipped: ["จัดส่งแล้ว", "#6D28D9"], delivered: ["ถึงแล้ว รอยืนยัน", "#0E7E5C"], completed: ["เสร็จสิ้น", C.ok], disputed: ["พิพาท", C.danger], return_requested: ["ขอคืนของ", "#C2410C"], return_approved: ["อนุมัติคืน", "#C2410C"], return_shipped: ["กำลังตีกลับ", "#6D28D9"], return_received: ["รับของคืนแล้ว", "#0E7E5C"], refunded: ["คืนเงินแล้ว", C.muted], cancelled: ["ยกเลิก", C.muted] };',
'          const list = allOrders.filter(o => (aoStatus === "ทั้งหมด" || o.status === aoStatus)',
'            && (!aoq.trim() || `${o.order_no || ""} ${o.item || ""} ${buyerOf(o.buyer_id)?.name || ""} ${sellerOf(o.seller_id)?.name || ""}`.toLowerCase().includes(aoq.toLowerCase())));',
'          return (',
'          <>',
'            <div>',
'              <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>คำสั่งซื้อ</div>',
'              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>ทุกสถานะ (ล่าสุด {allOrders.length} รายการ) — คลิกรายการเพื่อเปิดศูนย์ข้อมูลออเดอร์</div>',
'            </div>',
'            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>',
'              <input value={aoq} onChange={e => setAoq(e.target.value)} placeholder="ค้นหาเลขออเดอร์ / สินค้า / ชื่อผู้ซื้อ-ผู้ขาย..."',
'                style={{ flex: "1 1 220px", height: 38, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 12.5, outline: "none", background: "#fff" }} />',
'              <select value={aoStatus} onChange={e => setAoStatus(e.target.value)} style={{ height: 38, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 8px", fontSize: 12, background: "#fff", maxWidth: 170 }}>',
'                <option value="ทั้งหมด">ทุกสถานะ</option>',
'                {Object.keys(AO_ST).map(k => <option key={k} value={k}>{AO_ST[k][0]}</option>)}',
'              </select>',
'            </div>',
'            {list.length === 0 && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "30px 0" }}>ไม่พบคำสั่งซื้อตามตัวกรอง</div>}',
'            {list.length > 0 && <div style={{ ...card, padding: 0, overflow: "hidden" }}>',
'              {list.map((o, i) => {',
'                const st = AO_ST[o.status] || [o.status, C.muted];',
'                return (',
'                  <div key={o.id} onClick={() => setSelOrder(o)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i ? `1px solid ${C.line}` : "none", cursor: "pointer" }}>',
'                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EDF2F2", overflow: "hidden", flexShrink: 0 }}>',
'                      {o.products?.images?.[0] && <img src={o.products.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}',
'                    </div>',
'                    <div style={{ flex: 1, minWidth: 0 }}>',
'                      <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.order_no} · {o.item}</div>',
'                      <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>ผู้ซื้อ {buyerOf(o.buyer_id)?.name || "-"} · ผู้ขาย {sellerOf(o.seller_id)?.name || "-"} · {o.created_at ? new Date(o.created_at).toLocaleDateString("th-TH") : "-"}</div>',
'                    </div>',
'                    <b style={{ color: C.brand, fontSize: 13, flexShrink: 0 }}>{baht(Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0))}</b>',
'                    <span style={{ fontSize: 10.5, fontWeight: 800, color: st[1], background: `${st[1]}18`, padding: "3px 9px", borderRadius: 999, flexShrink: 0 }}>{st[0]}</span>',
'                  </div>',
'                );',
'              })}',
'            </div>}',
'          </>',
'          );',
'        })()}',
'')

EDITS = [
    # A) กระดิ่งโอนไม่สำเร็จ → link /kyc
    (PAYOUT,
     '      body: `${o.item} — ${failNote.trim()}`, ref: o.order_no,',
     '      body: `${o.item} — ${failNote.trim()}`, ref: o.order_no, link: "/kyc", // ADMIN-UX2: กดกระดิ่งไปหน้าบัญชีรับเงินตรง',
     1),
    # B1) page.js: โหลด allOrders
    (PAGE,
     '  // ข้อมูลบัญชีผู้รับเงิน (PayeeInfo)',
     L('  // ADMIN-UX2: คำสั่งซื้อทั้งหมด (ทุกสถานะ ล่าสุด 300) — แท็บ "คำสั่งซื้อ" เปิดดูได้แม้พ้นคิวแล้ว',
       '  const { data: allOrders } = await supabase.from("orders")',
       '    .select("*, products(images)")',
       '    .order("created_at", { ascending: false }).limit(300);',
       '',
       '  // ข้อมูลบัญชีผู้รับเงิน (PayeeInfo)'),
     1),
    # B2) page.js: sellerIds รวมจาก allOrders
    (PAGE,
     '  const sellerIds = [...new Set((orders || []).map(o => o.seller_id))];',
     '  const sellerIds = [...new Set([...(orders || []), ...(allOrders || [])].map(o => o.seller_id))]; // ADMIN-UX2: รวมผู้ขายจากทุกออเดอร์',
     1),
    # B3) page.js: buyers รวมจาก allOrders
    (PAGE,
     L('  const { data: buyers } = (orders || []).length',
       '    ? await supabase.from("profiles").select("id, name, phone").in("id", [...new Set(orders.map(o => o.buyer_id))])',
       '    : { data: [] };'),
     L('  const buyerIds = [...new Set([...(orders || []), ...(allOrders || [])].map(o => o.buyer_id))]; // ADMIN-UX2',
       '  const { data: buyers } = buyerIds.length',
       '    ? await supabase.from("profiles").select("id, name, phone").in("id", buyerIds)',
       '    : { data: [] };'),
     1),
    # B4) page.js: ส่ง prop
    (PAGE,
     '  return <AdminClient orders={orders || []} sellers={sellers || []} buyers={buyers || []} userId={user.id}',
     '  return <AdminClient orders={orders || []} allOrders={allOrders || []} sellers={sellers || []} buyers={buyers || []} userId={user.id}',
     1),
    # B5) AdminClient: รับ prop
    (ADMIN,
     'export default function AdminClient({ orders, sellers, buyers, userId,',
     'export default function AdminClient({ orders, allOrders = [], sellers, buyers, userId,',
     1),
    # B6) AdminClient: เมนูกลุ่มการเงิน
    (ADMIN,
     '      { k: "returns", icon: RotateCcw, label: "คืนของ/พิพาท", n: returnQ.length },',
     L('      { k: "returns", icon: RotateCcw, label: "คืนของ/พิพาท", n: returnQ.length },',
       '      { k: "allorders", icon: ShoppingBag, label: "คำสั่งซื้อ" }, // ADMIN-UX2: ทุกออเดอร์ทุกสถานะ'),
     1),
    # B7) AdminClient: whitelist ?tab=
    (ADMIN, '"words", "seo", "approve"]', '"words", "seo", "approve", "allorders"]', 1),
    # B8) AdminClient: state ค้นหา/กรอง
    (ADMIN,
     '  const [fail, setFail] = useState(null);           // orderId ที่โอนไม่สำเร็จ',
     L('  const [fail, setFail] = useState(null);           // orderId ที่โอนไม่สำเร็จ',
       '  const [aoq, setAoq] = useState("");               // ADMIN-UX2: ค้นหาในแท็บคำสั่งซื้อ',
       '  const [aoStatus, setAoStatus] = useState("ทั้งหมด"); // ADMIN-UX2: กรองสถานะ'),
     1),
    # B9) AdminClient: แท็บใหม่ — แทรกเหนือแท็บอนุมัติสินค้า
    (ADMIN,
     '        {/* ── ADMIN-UX: คิวอนุมัติสินค้า (status review) — API/ปุ่ม/ReasonModal ชุดเดิมจากแท็บสินค้า ── */}',
     ALLORDERS_TAB + '        {/* ── ADMIN-UX: คิวอนุมัติสินค้า (status review) — API/ปุ่ม/ReasonModal ชุดเดิมจากแท็บสินค้า ── */}',
     1),
]

# C) KycClient: ฟังก์ชัน savePayee ใหม่ — แทนทั้ง block แบบระบุช่วง (หัวฟังก์ชัน → "  };" ตัวแรก)
#    (บทเรียนสด: anchor หลายบรรทัดพังเพราะไฟล์จริงต่างจากสำเนา — ใช้หัวบรรทัดเดียว + หาจุดปิดแบบโปรแกรมแทน)
SAVEPAYEE_NEW = L(
'  const savePayee = async () => {',
'    setBusy(true);',
'    const bank = payee.accNo.trim() ? { bank: payee.bank, no: payee.accNo.trim(), name: payee.accName.trim() } : null;',
'    // ADMIN-UX2: บันทึกผ่าน API — ฝั่ง server ปิดวงจรแจ้งเตือนแอดมินเมื่อมีธงโอนไม่สำเร็จค้าง',
'    const res = await fetch("/api/kyc/payee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptpay: payee.promptpay.trim(), bank }) });',
'    setBusy(false);',
'    if (!res.ok) { const j = await res.json().catch(() => ({})); setPayeeMsg(j.error || "บันทึกไม่สำเร็จ ลองใหม่"); setTimeout(() => setPayeeMsg(""), 3000); return; }',
'    setProfile(p => ({ ...p, promptpay: payee.promptpay.trim() || null, bank }));',
'    setPayeeMsg("บันทึกบัญชีรับเงินแล้ว ✓");',
'    setTimeout(() => setPayeeMsg(""), 2500);',
'  };')

# ═══ ตรวจทุก anchor ก่อนแตะไฟล์ (all-or-nothing) ═══
contents = {p: read(p) for p in (PAYOUT, PAGE, ADMIN, KYCC)}
for path, old, _new, expect in EDITS:
    n = contents[path].count(old)
    assert n == expect, "anchor คาด %d เจอ %d ใน %s: %s" % (expect, n, os.path.relpath(path, ROOT), old[:70].replace("\r\n", " | "))

# ตรวจช่วง savePayee: หัวบรรทัดเดียว → บรรทัดปิด "  };" ตัวแรกถัดไป
# (บทเรียนสด 2: KycClient.js เป็น LF ไม่ใช่ CRLF — ตรวจจับ newline ของไฟล์เองเสมอ)
k = contents[KYCC]
nlK = "\r\n" if "\r\n" in k else "\n"
head = "  const savePayee = async () => {"
assert k.count(head + nlK) == 1, "ไม่เจอหัวฟังก์ชัน savePayee (หรือเจอซ้ำ)"
i0 = k.index(head)
i1 = k.index(nlK + "  };", i0)
assert 0 < i1 - i0 < 1500, "ช่วงฟังก์ชัน savePayee ยาวผิดปกติ"
old_savepayee = k[i0:i1 + len(nlK + "  };")]
assert "promptpay" in old_savepayee and "setPayeeMsg" in old_savepayee, "เนื้อ savePayee ไม่ตรงคาด"
SAVEPAYEE_FINAL = SAVEPAYEE_NEW.replace("\r\n", nlK)  # เขียนกลับด้วย newline แบบเดียวกับไฟล์

# ═══ ลงมือ ═══
os.makedirs(PAYEE_DIR, exist_ok=True)
write(PAYEE_FILE, PAYEE_SRC)
print("OK: สร้าง app/api/kyc/payee/route.js")
contents[KYCC] = contents[KYCC].replace(old_savepayee, SAVEPAYEE_FINAL, 1)
for path, old, new, _expect in EDITS:
    contents[path] = contents[path].replace(old, new)
for p, s in contents.items():
    write(p, s)
    print("OK: patch", os.path.relpath(p, ROOT))

print("DONE: ADMIN-UX2 ครบ 5 ไฟล์ — ต่อไป: npm run build")
