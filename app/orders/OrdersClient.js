"use client";
// app/orders/OrdersClient.js — ลิสต์การซื้อ/การขายของฉัน (spec §3–4)
// การ์ดคลิกทั้งใบ → หน้ารายละเอียด /orders/[id] — ปุ่ม/ฟอร์มทั้งหมดย้ายไปหน้ารายละเอียดแล้ว (หน่วย OD1)
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", ok: "#1E8E3E" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const RETURN_FLOW = ["disputed", "return_requested", "return_approved", "return_shipped", "return_received", "refunded", "cancelled"]; // cancelled รวมในกลุ่มปัญหา/คืนเงิน

// ป้ายสถานะแยกบทบาท (ชุดเดียวกับหน้ารายละเอียด — spec §5)
const BUYER_BADGE = {
  pending_payment: ["รอชำระเงิน", "#B7791F"], pending_verification: ["รอแอดมินตรวจสอบ", "#B7791F"],
  payment_verified: ["ชำระแล้ว · รอผู้ขายจัดส่ง", C.brand], shipped: ["จัดส่งแล้ว", C.brand],
  delivered: ["ยืนยันรับแล้ว · รอระบบปิดยอด", C.brand], completed: ["สำเร็จ", C.ok],
  disputed: ["อยู่ระหว่างข้อพิพาท", C.danger], return_requested: ["ขอคืน · รอแอดมินพิจารณา", "#B7791F"],
  return_approved: ["อนุมัติคืน · รอคุณส่งกลับ", "#B7791F"], return_shipped: ["ส่งคืนแล้ว · รอผู้ขายรับ", "#B7791F"],
  return_received: ["ผู้ขายรับคืนแล้ว · รอคืนเงิน", C.brand], refunded: ["คืนเงินแล้ว", C.muted],
  cancelled: ["ยกเลิก · รอเงินคืน", C.danger],
};
const SELLER_BADGE = {
  pending_payment: ["รอผู้ซื้อชำระ", "#B7791F"], pending_verification: ["แอดมินตรวจสลิป", "#B7791F"],
  payment_verified: ["ต้องจัดส่ง!", C.danger], shipped: ["จัดส่งแล้ว · รอผู้ซื้อยืนยัน", C.brand],
  delivered: ["ผู้ซื้อรับแล้ว · รอรับเงิน", C.brand], completed: ["เสร็จสิ้น · ได้รับเงินแล้ว", C.ok],
  disputed: ["มีข้อพิพาท", C.danger], return_requested: ["ผู้ซื้อขอคืน · รอแอดมิน", "#B7791F"],
  return_approved: ["อนุมัติคืน · รอผู้ซื้อส่งกลับ", "#B7791F"], return_shipped: ["ของคืนกำลังมา · รอคุณรับ", C.danger],
  return_received: ["รับคืนแล้ว · รอระบบคืนเงิน", C.brand], refunded: ["คืนเงินผู้ซื้อแล้ว", C.muted],
  cancelled: ["ถูกยกเลิก — ไม่จัดส่งตามกำหนด", C.danger],
};

// แถบ ⚡ hint งานที่ต้องทำ — ข้อความตามความจริงของระบบเท่านั้น (กติกาข้อ 18)
const HINT = {
  buy: {
    pending_payment: "⚡ รอคุณชำระเงิน — โอนแล้วแนบสลิปเพื่อเริ่มการคุ้มครอง escrow",
    shipped: "⚡ ของกำลังมา — ได้รับแล้วกดยืนยันเพื่อปล่อยเงินให้ผู้ขาย (ไม่กดภายในกำหนด ระบบยืนยันให้อัตโนมัติ)",
    return_approved: "⚡ อนุมัติคืนแล้ว — ส่งของกลับและกรอกเลขพัสดุในหน้ารายละเอียด",
  },
  sell: {
    payment_verified: "⚡ ถึงตาคุณแล้ว — เข้าไปแจ้งจัดส่ง + กรอกเลขพัสดุ",
    return_shipped: "⚡ ของคืนกำลังมา — รับแล้วถ่ายรูปสภาพและกดยืนยัน (เลยกำหนด ระบบยืนยันแทนอัตโนมัติ)",
  },
};

export default function OrdersClient({ orders, userId, initialRole = "buy" }) {
  const router = useRouter();
  const tab = initialRole === "sell" ? "sell" : "buy"; // บทบาทล็อกจากเมนู (?role=)
  const [statusF, setStatusF] = useState("ทั้งหมด");

  const GROUPS = {
    buy: [
      ["รอชำระเงิน", ["pending_payment"]],
      ["รอตรวจสอบ", ["pending_verification"]],
      ["ที่ต้องได้รับ", ["payment_verified", "shipped"]],
      ["สำเร็จ", ["delivered", "completed"]],
      ["ปัญหา/คืนเงิน", RETURN_FLOW],
    ],
    sell: [
      ["ต้องจัดส่ง", ["payment_verified"]],
      ["จัดส่งแล้ว", ["shipped"]],
      ["รอรับเงิน", ["delivered"]],
      ["เสร็จสิ้น", ["completed"]],
      ["คืนของ", RETURN_FLOW],
      ["รอชำระ/ตรวจ", ["pending_payment", "pending_verification"]],
    ],
  };
  const groups = GROUPS[tab];
  const roleList = useMemo(() => orders.filter(o => tab === "buy" ? o.buyer_id === userId : o.seller_id === userId), [orders, tab, userId]);
  const list = useMemo(() => {
    if (statusF === "ทั้งหมด") return roleList;
    const g = groups.find(x => x[0] === statusF);
    return g ? roleList.filter(o => g[1].includes(o.status)) : roleList;
  }, [roleList, statusF, tab]);

  const BADGE = tab === "sell" ? SELLER_BADGE : BUYER_BADGE;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" aria-label="กลับหน้าแรก" style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "grid", placeItems: "center", color: C.ink, textDecoration: "none", flex: "none", fontSize: 18 }}>‹</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>{tab === "buy" ? "การซื้อของฉัน" : "การขายของฉัน"}</div>
        </div>

        {/* ชิปกรองสถานะพร้อมตัวนับ — "ทั้งหมด" ท้ายแถวเสมอ (spec §3) */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {[...groups.map(g => g[0]), "ทั้งหมด"].map(k => {
            const g = groups.find(x => x[0] === k);
            const n = k === "ทั้งหมด" ? roleList.length : roleList.filter(o => g[1].includes(o.status)).length;
            const on = statusF === k;
            return (
              <div key={k} onClick={() => setStatusF(k)} style={{ flex: "none", padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                background: on ? C.brand : "#fff", color: on ? "#fff" : C.muted, border: `1px solid ${on ? C.brand : C.line}` }}>
                {k} ({n})
              </div>
            );
          })}
        </div>

        {list.length === 0 && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 0" }}>ยังไม่มีรายการในหมวดนี้</div>}

        {list.map(o => {
          const b = BADGE[o.status] || [o.status, C.muted];
          const hint = HINT[tab][o.status];
          const total = Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0);
          const sellerNet = Number(o.price) + Number(o.ship_fee || 0) - Number(o.seller_fee || 0);
          return (
            <div key={o.id} onClick={() => router.push(`/orders/${o.id}`)}
              style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 16px rgba(0,0,0,.05)", cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 54, height: 54, borderRadius: 10, background: "#EDF2F2", overflow: "hidden", flexShrink: 0 }}>
                  {o.products?.images?.[0] && <img src={o.products.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.item}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: b[1], background: `${b[1]}18`, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", flex: "none" }}>{b[0]}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{o.order_no} · {new Date(o.created_at).toLocaleDateString("th-TH")}</div>
                  {tab === "sell" ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.brand }}>{baht(sellerNet)}</span>
                      <span style={{ fontSize: 10.5, color: C.muted }}>ยอดที่จะได้รับ (รวมค่าส่ง)</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.brand }}>{baht(total)}</div>
                  )}
                </div>
                <ChevronRight size={17} color={C.muted} style={{ flex: "none" }} />
              </div>
              {hint && (
                <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "8px 12px", marginTop: 10 }}>{hint}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
