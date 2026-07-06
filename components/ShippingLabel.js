"use client";
// components/ShippingLabel.js — ใบปะหน้าพัสดุแบบพิมพ์ได้ (derive จาก prototype ออเดอร์ บรรทัด 569–609)
// ใช้โดยหน้ารายละเอียดออเดอร์ฝั่งผู้ขาย — โลโก้/เลขออเดอร์/ผู้ส่ง/ผู้รับ + window.print
// หมายเหตุ: เป็น 1 ใน component กลาง (ห้ามสร้างตัวแปรซ้ำที่อื่น)
const C = { brand: "#0E7E8C", ink: "#101314", line: "#E5E9EA" };

const fmtAddr = a => a ? [a.addr, a.sub, a.district, a.province, a.zip].filter(Boolean).join(" ") : "";

export default function ShippingLabel({ order, sender, onClose }) {
  const st = order?.ship_to;
  if (!st) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.55)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      {/* ซ่อนทุกอย่างตอนพิมพ์ ยกเว้นใบปะหน้า */}
      <style>{`@media print { body * { visibility: hidden !important; } .print-label, .print-label * { visibility: visible !important; } .print-label { position: fixed; inset: 0; margin: 24px; } .no-print { display: none !important; } }`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, padding: 18 }}>

        <div className="print-label" style={{ border: "2px solid #101314", borderRadius: 8, padding: "22px 24px", background: "#fff", color: "#101314" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: "1.5px solid #101314", marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: .3 }}>🎣 ClubAngler</div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>{order.order_no}</div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 4 }}>ผู้ส่ง</div>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <b>{sender?.name || "-"}</b>{sender?.phone ? ` · ${sender.phone}` : ""}<br />
              {sender?.address || fmtAddr(sender) || "-"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 4 }}>ผู้รับ</div>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.5 }}>{st.name}</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>โทร {st.phone}</div>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>{st.full || fmtAddr(st)}</div>
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, height: 42, border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ปิด</button>
          <button onClick={() => window.print()} style={{ flex: 2, height: 42, border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>🖨 พิมพ์ใบปะหน้า</button>
        </div>
      </div>
    </div>
  );
}
