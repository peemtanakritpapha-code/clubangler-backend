# -*- coding: utf-8 -*-
# patch-admin-ux.py — D2 ADMIN-UX: หลังบ้านแอดมิน (แพทเทิร์น/ธีมเดิมทั้งหมด)
#   1) เมนู sidebar จัดหมวด 5 กลุ่ม (ภาพรวม/การเงิน/คิวตรวจสอบ/จัดการข้อมูล/ตั้งค่า)
#   2) แท็บใหม่ "อนุมัติสินค้า" (status review) + badge + การ์ดใน "กล่องงานเข้าวันนี้"
#   3) แจ้งเตือนกระดิ่งแอดมิน: สินค้ารออนุมัติ + โพสต์รออนุมัติ (ผ่าน notifyAdmins จุดเดียวตามกติกา)
#   4) จุดคลิกได้: ลิงก์ "ดูรายละเอียดทั้งหมด" อัปเป็นปุ่ม pill เด่น (4 คิวการเงิน ใช้ modal AD2 เดิม)
#      + อนุมัติสินค้าเปิดหน้าสินค้าจริง + ผู้ใช้มีปุ่ม "โปรไฟล์ ↗" ไปหน้าสาธารณะ
# กติกา: anchor + assert count ตามคาด + marker ADMIN-UX กันรันซ้ำ + คง CRLF + all-or-nothing
# วิธีรัน (จากโฟลเดอร์โปรเจกต์): py patch-admin-ux.py

import io, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
ADMIN = os.path.join(ROOT, "app", "admin", "AdminClient.js")
SAVE  = os.path.join(ROOT, "app", "api", "products", "save", "route.js")
POSTC = os.path.join(ROOT, "app", "api", "posts", "create", "route.js")

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()
def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)
def L(*lines):  # ต่อบรรทัดด้วย CRLF
    return "\r\n".join(lines)

# ── กันรันซ้ำ ──
for p in (ADMIN, SAVE, POSTC):
    if "ADMIN-UX" in read(p):
        print("SKIP: พบ marker ADMIN-UX ใน", os.path.relpath(p, ROOT), "— เคยรันแล้ว ไม่ทำซ้ำ"); sys.exit(0)

# ═══ ชิ้นใหม่ ═══

MENU_NEW = L(
'  // ADMIN-UX: เมนูจัดหมวด 5 กลุ่ม — ทุกหน้า/แผงคือของเดิม แค่จัดกลุ่ม + เพิ่มแท็บ "อนุมัติสินค้า"',
'  const MENU_GROUPS = [',
'    { h: null, items: [{ k: "overview", icon: BarChart3, label: "ภาพรวม" }] },',
'    { h: "การเงิน", items: [',
'      { k: "verify", icon: ReceiptText, label: "ตรวจสลิป", n: verifyQ.length },',
'      { k: "payout", icon: Wallet, label: "โอนเงิน/คืนเงิน", n: payoutQ.length + refundQ.length },',
'      { k: "returns", icon: RotateCcw, label: "คืนของ/พิพาท", n: returnQ.length },',
'    ] },',
'    { h: "คิวตรวจสอบ", items: [',
'      { k: "approve", icon: Package, label: "อนุมัติสินค้า", n: approveQ.length },',
'      { k: "posts", icon: FileText, label: "จัดการโพสต์", n: pendingPostsQ.length },',
'      { k: "reports", icon: Flag, label: "รายงานเนื้อหา", n: reportsQ.length },',
'      { k: "kyc", icon: Users, label: "ยืนยันตัวตน (KYC)", n: kycQueue.length },',
'    ] },',
'    { h: "จัดการข้อมูล", items: [',
'      { k: "products", icon: Package, label: "สินค้าทั้งหมด" },',
'      { k: "users", icon: Users, label: "ผู้ใช้" },',
'    ] },',
'    { h: "ตั้งค่า", items: [',
'      { k: "words", icon: ShieldAlert, label: "คำต้องห้าม" },',
'      { k: "payment", icon: ShoppingBag, label: "การรับชำระเงิน" },',
'      { k: "fees", icon: Percent, label: "ค่าธรรมเนียม" },',
'      { k: "seo", icon: Globe, label: "SEO" },',
'      { k: "settings", icon: Settings, label: "ตั้งค่าระบบ" },',
'    ] },',
'  ];')

SIDEBAR_NEW = L(
'        {MENU_GROUPS.map((g, gi) => (',
'          <div key={gi} style={narrow ? { display: "flex", gap: 4 } : undefined}>',
'            {g.h && !narrow && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: "#6B7075", padding: "14px 10px 5px" }}>{g.h}</div>}',
'            {g.items.map(it => <SideItem key={it.k} it={it} />)}',
'          </div>',
'        ))}')

APPROVE_TAB = L(
'        {/* ── ADMIN-UX: คิวอนุมัติสินค้า (status review) — API/ปุ่ม/ReasonModal ชุดเดิมจากแท็บสินค้า ── */}',
'        {tab === "approve" && (approveQ.length === 0',
'          ? <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 0" }}>ไม่มีสินค้ารออนุมัติ 🎉</div>',
'          : approveQ.map(p => (',
'            <div key={p.id} style={{ ...card, display: "flex", gap: 12, alignItems: "center" }}>',
'              <div style={{ width: 48, height: 48, borderRadius: 8, background: "#EDF2F2", overflow: "hidden", flexShrink: 0 }}>',
'                {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}',
'              </div>',
'              <div style={{ flex: 1, minWidth: 0 }}>',
'                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>',
'                <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{baht(p.price)} · {p.cat_main || "-"}{p.cat_sub ? ` › ${p.cat_sub}` : ""}{p.brand ? ` · ${p.brand}` : ""} · ผู้ขาย {sellerOf(p.seller_id)?.name || p.seller_name || "-"}</div>',
'                <a href={`/product/${p.id}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 3, fontSize: 11.5, color: C.brand, fontWeight: 800, background: C.brandTint, padding: "4px 10px", borderRadius: 8, textDecoration: "none" }}>ดูหน้าสินค้าจริง ↗</a>',
'              </div>',
'              <button onClick={() => call("/api/admin/product-status", { productId: p.id, action: "restore" })} disabled={busy}',
'                style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "none", background: C.ok, color: "#fff", fontWeight: 800, fontSize: 11.5, cursor: "pointer", flexShrink: 0 }}>✓ อนุมัติ</button>',
'              <button onClick={() => setSuspendP(p.id)} disabled={busy}',
'                style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${C.danger}`, background: "#fff", color: C.danger, fontWeight: 800, fontSize: 11.5, cursor: "pointer", flexShrink: 0 }}>ปฏิเสธ</button>',
'            </div>',
'          )))}',
'')

# ═══ รายการแก้แบบ replace ตรง (ไฟล์, old, new, จำนวนครั้งที่คาด) ═══
EDITS = [
    # 1) นิยาม approveQ + รวมใน totalTasks
    (ADMIN,
     '  const totalTasks = verifyQ.length + returnQ.length + payoutQ.length + refundQ.length + kycQueue.length + reportsQ.length + pendingPostsQ.length;',
     L('  const approveQ = useMemo(() => products.filter(p => p.status === "review"), [products]); // ADMIN-UX: คิวสินค้ารออนุมัติ',
       '  const totalTasks = verifyQ.length + returnQ.length + payoutQ.length + refundQ.length + kycQueue.length + reportsQ.length + pendingPostsQ.length + approveQ.length;'),
     1),
    # 2) การ์ดใหม่ใน "กล่องงานเข้าวันนี้" — แทรกเหนือการ์ดรายงานเนื้อหา
    (ADMIN,
     '    ["รายงานเนื้อหา", reportsQ, "reports"',
     L('    ["สินค้ารออนุมัติ", approveQ, "approve", "SLA 12 ชม.", "#E3F1F3", "#0E7E8C", Package], // ADMIN-UX',
       '    ["รายงานเนื้อหา", reportsQ, "reports"'),
     1),
    # 3) whitelist ?tab= เพิ่ม approve
    (ADMIN, '"words", "seo"]', '"words", "seo", "approve"]', 1),
    # 4) render sidebar เป็นกลุ่ม
    (ADMIN, '        {MENU.map(it => <SideItem key={it.k} it={it} />)}', SIDEBAR_NEW, 1),
    # 5) แท็บอนุมัติสินค้า — แทรกเหนือแท็บสินค้าเดิม
    (ADMIN,
     '        {tab === "products" && (() => {',
     APPROVE_TAB + '        {tab === "products" && (() => {',
     1),
    # 6) อัปลิงก์ "ดูรายละเอียดทั้งหมด" เป็นปุ่ม pill เด่น — 4 คิวการเงิน (จงใจแก้ทั้ง 4)
    (ADMIN,
     '<span onClick={() => setSelOrder(o)} style={{ display: "inline-block", marginTop: 2, fontSize: 11, color: C.brand, fontWeight: 800, cursor: "pointer" }}>ดูรายละเอียดทั้งหมด ›</span>',
     '<span onClick={() => setSelOrder(o)} style={{ display: "inline-block", marginTop: 4, fontSize: 11.5, color: C.brand, fontWeight: 800, cursor: "pointer", background: C.brandTint, padding: "4px 10px", borderRadius: 8 }}>ดูรายละเอียดทั้งหมด ›</span>',
     4),
    # 7) ปุ่มโปรไฟล์สาธารณะในแถวผู้ใช้
    (ADMIN,
     '                    <span style={{ fontSize: 10.5, fontWeight: 800, color: kb[1], background: kb[2], padding: "3px 10px", borderRadius: 999, flex: "none" }}>{kb[0]}</span>',
     L('                    <span style={{ fontSize: 10.5, fontWeight: 800, color: kb[1], background: kb[2], padding: "3px 10px", borderRadius: 999, flex: "none" }}>{kb[0]}</span>',
       '                    <a href={`/seller/${u.id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: "none", fontSize: 11, fontWeight: 800, color: C.brand, background: C.brandTint, padding: "5px 10px", borderRadius: 8, textDecoration: "none" }}>โปรไฟล์ ↗</a>'),
     1),
    # 8) products/save: import notifyAdmins
    (SAVE,
     'import { productPath } from "@/lib/slug"; // AEO-4 (Iron 22)',
     L('import { productPath } from "@/lib/slug"; // AEO-4 (Iron 22)',
       'import { notifyAdmins } from "@/lib/notifyAdmins"; // ADMIN-UX'),
     1),
    # 9) products/save: แจ้งเตือนเมื่อเข้าคิว review
    (SAVE,
     '  return NextResponse.json({ ok: true, status, needsReview });',
     L('  // ADMIN-UX: สินค้าเข้าคิวตรวจ → แจ้งเตือนแอดมินทันที (fire-and-forget แนวเดียว pingIndexNow — ห้าม await)',
       '  if (status === "review" && (!current || current.status !== "review"))',
       '    notifyAdmins(admin, { icon: "📦", title: "สินค้ารออนุมัติ", body: name, ref: saved?.id ? String(saved.id) : null, link: "/admin?tab=approve" }).catch(() => {});',
       '  return NextResponse.json({ ok: true, status, needsReview });'),
     1),
    # 10) posts/create: import notifyAdmins
    (POSTC,
     'import { checkContent, filterMessage } from "@/lib/contentFilter"; // AUTO1',
     L('import { checkContent, filterMessage } from "@/lib/contentFilter"; // AUTO1',
       'import { notifyAdmins } from "@/lib/notifyAdmins"; // ADMIN-UX'),
     1),
    # 11) posts/create: แจ้งเตือนเมื่อโพสต์ pending
    (POSTC,
     '  return NextResponse.json({ ok: true, status });',
     L('  // ADMIN-UX: โพสต์เข้าคิวอนุมัติ → แจ้งเตือนแอดมิน (แนวเดียวกับสลิป/KYC/รายงาน)',
       '  if (status === "pending")',
       '    notifyAdmins(admin, { icon: "📝", title: "โพสต์รออนุมัติ", body: (text || "").slice(0, 80), link: "/admin?tab=posts" }).catch(() => {});',
       '  return NextResponse.json({ ok: true, status });'),
     1),
]

# ═══ ตรวจทุกอย่างก่อนแตะไฟล์ (all-or-nothing) ═══
contents = {p: read(p) for p in (ADMIN, SAVE, POSTC)}

for path, old, _new, expect in EDITS:
    n = contents[path].count(old)
    assert n == expect, "anchor คาด %d เจอ %d ใน %s: %s" % (expect, n, os.path.relpath(path, ROOT), old[:70])

# ตรวจบล็อก MENU เดิม (แทนที่แบบระบุช่วง: บรรทัดเปิด → บรรทัดปิด "];")
a = contents[ADMIN]
start_line = '  const MENU = ['
assert a.count(start_line + '\r\n') == 1, "ไม่เจอบรรทัดเปิด const MENU"
i0 = a.index(start_line)
i1 = a.index('\r\n  ];', i0)
assert 0 < i1 - i0 < 2000, "ช่วงบล็อก MENU ผิดปกติ"
old_menu = a[i0:i1 + len('\r\n  ];')]
assert '"overview"' in old_menu and '"settings"' in old_menu and old_menu.count('];') == 1, "เนื้อบล็อก MENU ไม่ตรงคาด"

# ═══ ลงมือ ═══
contents[ADMIN] = contents[ADMIN].replace(old_menu, MENU_NEW, 1)
for path, old, new, expect in EDITS:
    contents[path] = contents[path].replace(old, new)
for p, s in contents.items():
    write(p, s)
    print("OK: patch", os.path.relpath(p, ROOT))

print("DONE: ADMIN-UX ครบ 3 ไฟล์ — ต่อไป: npm run build")
