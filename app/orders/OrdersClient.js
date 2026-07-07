"use client";
// app/orders/OrdersClient.js — ลิสต์การซื้อ/การขายของฉัน (ดีไซน์ใหม่ตาม mock ก.ค. 69)
// การ์ดคลิกทั้งใบ → /orders/[id] — แถบ ⚡ เป็นตัวบอกงาน (ไม่มีปุ่ม ปุ่ม/ฟอร์มอยู่หน้ารายละเอียดตาม OD1)
// โครงใหม่: chips "งานของคุณวันนี้" กรองเร็ว → แท็บ segmented → รายการจัดหมวดตามความเร่ง + progress dots
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Fish } from "lucide-react";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", ok: "#1E8E3E", amber: "#B7791F", amberBg: "#FFF8EC" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const RETURN_FLOW = ["disputed", "return_requested", "return_approved", "return_shipped", "return_received", "refunded", "cancelled"];
const thDate = t => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

// สถานะ → [ป้าย, สี, ขั้น timeline 0-5 | "R0".."R4" = สายคืน/ยกเลิก] — ข้อความชุดเดียวกับหน้ารายละเอียด (spec §5)
const BUYER_S = {
  pending_payment: ["รอชำระเงิน", C.amber, 1], pending_verification: ["รอแอดมินตรวจสอบ", C.amber, 2],
  payment_verified: ["ชำระแล้ว · รอผู้ขายจัดส่ง", C.brand, 3], shipped: ["จัดส่งแล้ว — ของกำลังมา", C.brand, 4],
  delivered: ["ยืนยันรับแล้ว · รอระบบปิดยอด", C.brand, 5], completed: ["สำเร็จ", C.ok, 5],
  disputed: ["อยู่ระหว่างข้อพิพาท", C.danger, "R0"], return_requested: ["ขอคืน · รอแอดมินพิจารณา", C.amber, "R0"],
  return_approved: ["อนุมัติคืน · รอคุณส่งกลับ", C.amber, "R1"], return_shipped: ["ส่งคืนแล้ว · รอผู้ขายรับ", C.amber, "R2"],
  return_received: ["ผู้ขายรับคืนแล้ว · รอคืนเงิน", C.brand, "R3"], refunded: ["คืนเงินแล้ว", C.muted, "R4"],
  cancelled: ["ยกเลิก · รอเงินคืน", C.danger, "R4"],
};
const SELLER_S = {
  pending_payment: ["รอผู้ซื้อชำระ", C.amber, 1], pending_verification: ["แอดมินตรวจสลิป", C.amber, 2],
  payment_verified: ["ต้องจัดส่ง!", C.danger, 3], shipped: ["จัดส่งแล้ว · รอผู้ซื้อยืนยัน", C.brand, 4],
  delivered: ["ผู้ซื้อรับแล้ว · รอรับเงิน", C.brand, 5], completed: ["เสร็จสิ้น · ได้รับเงินแล้ว", C.ok, 5],
  disputed: ["มีข้อพิพาท", C.danger, "R0"], return_requested: ["ผู้ซื้อขอคืน · รอแอดมิน", C.amber, "R0"],
  return_approved: ["อนุมัติคืน · รอผู้ซื้อส่งกลับ", C.amber, "R1"], return_shipped: ["ของคืนกำลังมา · รอคุณรับ", C.danger, "R2"],
  return_received: ["รับคืนแล้ว · รอระบบคืนเงิน", C.brand, "R3"], refunded: ["คืนเงินผู้ซื้อแล้ว", C.muted, "R4"],
  cancelled: ["ถูกยกเลิก — ไม่จัดส่งตามกำหนด", C.danger, "R4"],
};

// แถบ ⚡ hint งานที่ต้องทำ — ข้อความตามความจริงของระบบเท่านั้น (กติกาข้อ 18)
const HINT = {
  buy: {
    pending_payment: "รอคุณชำระเงิน — โอนแล้วแนบสลิปเพื่อเริ่มการคุ้มครอง escrow",
    shipped: "ของกำลังมา — ได้รับแล้วกดยืนยันเพื่อปล่อยเงินให้ผู้ขาย (ไม่กดภายในกำหนด ระบบยืนยันให้อัตโนมัติ)",
    return_approved: "อนุมัติคืนแล้ว — ส่งของกลับและกรอกเลขพัสดุในหน้ารายละเอียด",
  },
  sell: {
    payment_verified: "ถึงตาคุณแล้ว — เข้าไปแจ้งจัดส่ง + กรอกเลขพัสดุ",
    return_shipped: "ของคืนกำลังมา — รับแล้วถ่ายรูปสภาพและกดยืนยัน (เลยกำหนด ระบบยืนยันแทนอัตโนมัติ)",
  },
};

const TABS = {
  buy: [["ทั้งหมด", null], ["รอชำระเงิน", ["pending_payment"]], ["รอตรวจสอบ", ["pending_verification"]], ["ที่ต้องได้รับ", ["payment_verified", "shipped"]], ["สำเร็จ", ["delivered", "completed"]], ["ปัญหา/คืนเงิน", RETURN_FLOW]],
  sell: [["ทั้งหมด", null], ["ต้องจัดส่ง", ["payment_verified"]], ["จัดส่งแล้ว", ["shipped"]], ["รอรับเงิน", ["delivered"]], ["เสร็จสิ้น", ["completed"]], ["คืนของ", RETURN_FLOW], ["รอชำระ/ตรวจ", ["pending_payment", "pending_verification"]]],
};

// mini progress: สายซื้อ 6 จุด / สายคืน 5 จุด
function Dots({ step, tone }) {
  const isR = String(step).startsWith("R");
  const total = isR ? 5 : 6;
  const cur = isR ? Number(String(step).slice(1)) : step;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flex: "none" }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ width: i === cur ? 8 : 5, height: i === cur ? 8 : 5, borderRadius: "50%", background: i < cur ? C.ok : i === cur ? tone : C.line }} />
      ))}
    </span>
  );
}

function OrderCard({ o, role, dim, onOpen }) {
  const [label, tone, step] = (role === "sell" ? SELLER_S : BUYER_S)[o.status] || [o.status, C.muted, 0];
  const hint = HINT[role][o.status];
  const total = Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0);
  const sellerNet = Number(o.price) + Number(o.ship_fee || 0) - Number(o.seller_fee || 0);
  const img = o.products?.images?.[0];
  return (
    <div onClick={onOpen} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.line}`, overflow: "hidden", cursor: "pointer", opacity: dim ? .72 : 1, boxShadow: "0 1px 3px rgba(16,19,20,.04)" }}>
      <div style={{ display: "flex", gap: 12, padding: "13px 14px 12px", position: "relative", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: tone }} />
        <div style={{ width: 68, height: 68, borderRadius: 12, background: C.brandTint, flex: "none", marginLeft: 4, overflow: "hidden", display: "grid", placeItems: "center", color: C.brand }}>
          {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Fish size={28} strokeWidth={1.6} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.item}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.brand, flex: "none" }}>{baht(role === "sell" ? o.price : total)}</div>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, margin: "3px 0 7px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {o.order_no} · {thDate(o.created_at)}{role === "sell" && <> · <b style={{ color: C.ok }}>รับสุทธิ {baht(sellerNet)}</b></>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Dots step={step} tone={tone} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: tone }}>{label}</span>
          </div>
        </div>
        <ChevronRight size={17} color={C.line} style={{ flex: "none" }} />
      </div>
      {hint && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 14px 9px 18px", background: C.amberBg, borderTop: "1px solid #F3E3C2" }}>
          <span style={{ fontSize: 11.5, color: C.amber, flex: 1, lineHeight: 1.55 }}>⚡ {hint}</span>
        </div>
      )}
    </div>
  );
}

export default function OrdersClient({ orders, userId, initialRole = "buy" }) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole === "sell" ? "sell" : "buy");
  const [tab, setTab] = useState("ทั้งหมด");
  const [quick, setQuick] = useState(null); // กรองจาก chip งานของคุณ (array ของ status)
  // เมนู dropdown ส่ง ?role= มาระหว่างที่หน้าเปิดอยู่ — state ไม่รีเซ็ตเองตอน client nav ต้อง sync ตาม prop
  useEffect(() => { setRole(initialRole === "sell" ? "sell" : "buy"); setTab("ทั้งหมด"); setQuick(null); }, [initialRole]);

  const roleList = useMemo(() => orders.filter(o => role === "buy" ? o.buyer_id === userId : o.seller_id === userId), [orders, role, userId]);
  const groups = TABS[role];
  const active = groups.find(t => t[0] === tab)?.[1] || null;
  const list = useMemo(
    () => roleList.filter(o => (quick ? quick.includes(o.status) : !active || active.includes(o.status))),
    [roleList, quick, active]
  );

  // จัดหมวดตามความเร่ง: มีงาน ⚡ → กำลังดำเนินการ → จบแล้ว (จาง)
  const H = HINT[role];
  const DONE = role === "sell" ? ["completed", "refunded", "cancelled"] : ["completed", "refunded", "delivered"]; // ผู้ซื้อ cancelled ยังรอเงินคืน = ไม่จบ
  const todo = list.filter(o => H[o.status]);
  const doing = list.filter(o => !H[o.status] && !DONE.includes(o.status));
  const done = list.filter(o => !H[o.status] && DONE.includes(o.status));

  // chips งานของคุณวันนี้ — นับจากทั้งบทบาท (ไม่ขึ้นกับแท็บ)
  const payDue = roleList.filter(o => o.status === "pending_payment");
  const incoming = roleList.filter(o => ["payment_verified", "shipped"].includes(o.status));
  const mustShip = roleList.filter(o => o.status === "payment_verified");
  const returnIn = roleList.filter(o => o.status === "return_shipped");
  const moneyIn = roleList.filter(o => ["shipped", "delivered"].includes(o.status))
    .reduce((t, o) => t + Number(o.price) + Number(o.ship_fee || 0) - Number(o.seller_fee || 0), 0);
  const payDueSum = payDue.reduce((t, o) => t + Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0), 0);

  const toggleQuick = sts => setQuick(q => (q && q[0] === sts[0] ? null : sts));
  const chipS = on => ({ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 11, border: `1.5px solid ${on ? C.brand : C.line}`, background: on ? C.brandTint : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.ink });
  const switchRole = r => { setRole(r); setTab("ทั้งหมด"); setQuick(null); };
  const isSell = role === "sell";
  const chips = [
    !isSell && payDue.length && <div key="pay" onClick={() => toggleQuick(["pending_payment"])} style={chipS(quick?.[0] === "pending_payment")}>💰 ต้องชำระ {payDue.length} รายการ <b style={{ color: C.amber }}>{baht(payDueSum)}</b></div>,
    !isSell && incoming.length && <div key="in" onClick={() => toggleQuick(["payment_verified", "shipped"])} style={chipS(quick?.[0] === "payment_verified")}>📦 ของกำลังมา {incoming.length} รายการ</div>,
    isSell && mustShip.length && <div key="ship" onClick={() => toggleQuick(["payment_verified"])} style={chipS(quick?.[0] === "payment_verified")}>🚚 ต้องจัดส่ง <b style={{ color: C.danger }}>{mustShip.length} รายการ</b></div>,
    isSell && returnIn.length && <div key="ret" onClick={() => toggleQuick(["return_shipped"])} style={chipS(quick?.[0] === "return_shipped")}>🔄 ของคืนกำลังมา {returnIn.length}</div>,
    isSell && moneyIn > 0 && <div key="money" style={{ ...chipS(false), cursor: "default" }}>💸 เงินกำลังเข้า <b style={{ color: C.ok }}>{baht(moneyIn)}</b></div>,
  ].filter(Boolean);

  const Section = ({ title, color, items, dim }) => items.length ? (
    <>
      <div style={{ fontSize: 12.5, fontWeight: 800, color, margin: "4px 2px 0" }}>{title} ({items.length})</div>
      {items.map(o => <OrderCard key={o.id} o={o} role={role} dim={dim} onOpen={() => router.push(`/orders/${o.id}`)} />)}
    </>
  ) : null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit", padding: "20px 14px 60px" }}>
      <style>{`.ca-tabs::-webkit-scrollbar{display:none}`}</style>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 12 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" aria-label="กลับหน้าแรก" style={{ width: 38, height: 38, borderRadius: 999, background: "#fff", border: `1px solid ${C.line}`, display: "grid", placeItems: "center", color: C.ink, textDecoration: "none", flex: "none", fontSize: 17 }}>‹</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, flex: 1 }}>{isSell ? "การขายของฉัน" : "การซื้อของฉัน"}</div>
          <div style={{ display: "flex", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 11, padding: 4, gap: 3 }}>
            {[["buy", "🛒 ซื้อ"], ["sell", "🏪 ขาย"]].map(([k, l]) => (
              <button key={k} onClick={() => switchRole(k)} style={{ height: 32, padding: "0 13px", border: "none", borderRadius: 8, background: role === k ? C.brand : "transparent", color: role === k ? "#fff" : C.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>
        </div>

        {chips.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 9 }}>งานของคุณวันนี้</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{chips}</div>
          </div>
        )}

        <div className="ca-tabs" style={{ display: "flex", gap: 6, overflowX: "auto", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 5, scrollbarWidth: "none" }}>
          {groups.map(([name, sts]) => {
            const n = sts ? roleList.filter(o => sts.includes(o.status)).length : roleList.length;
            const on = tab === name && !quick;
            return (
              <button key={name} onClick={() => { setTab(name); setQuick(null); }} style={{ flex: "none", height: 36, padding: "0 13px", borderRadius: 9, border: "none", background: on ? C.brand : "transparent", color: on ? "#fff" : C.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                {name}<span style={{ fontSize: 11, fontWeight: 800, background: on ? "rgba(255,255,255,.25)" : C.bg, borderRadius: 999, padding: "1px 7px", color: on ? "#fff" : C.muted }}>{n}</span>
              </button>
            );
          })}
        </div>

        <Section title="⚡ ต้องทำตอนนี้" color={C.amber} items={todo} />
        <Section title="กำลังดำเนินการ" color={C.muted} items={doing} />
        <Section title="เสร็จสิ้น / ปิดแล้ว" color={C.muted} items={done} dim />

        {list.length === 0 && <div style={{ textAlign: "center", padding: "50px 0", color: C.muted, fontSize: 13.5 }}>🎣 ไม่มีรายการในหมวดนี้</div>}
      </div>
    </div>
  );
}
