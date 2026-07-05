"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", warn: "#B7791F", warnBg: "#FEF6E7" };
const baht = n => "฿" + Number(n || 0).toLocaleString();

export default function PayClient({ order: o, config, userId }) {
  const router = useRouter();
  const supabase = createClient();
  const total = Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [amount, setAmount] = useState(total);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submitted = o.status === "pending_verification";
  const rejected = o.status === "pending_payment" && o.slip_reject_reason;

  const pick = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    setErr("");
    if (!file) return setErr("แนบสลิปโอนเงินก่อนส่ง");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${o.order_no}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("slips").upload(path, file);
      if (upErr) throw upErr;
      const res = await fetch(`/api/orders/${o.id}/slip`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slipPath: path, transferAmount: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งสลิปไม่สำเร็จ");
      router.refresh();
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };

  const card = { background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };
  const banks = Array.isArray(config?.banks) ? config.banks : [];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/market" style={{ color: C.brand, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>‹ ตลาดสินค้า</Link>
          <div style={{ fontWeight: 800, color: C.brand }}>💳 ชำระเงิน</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: C.muted }}>คำสั่งซื้อ {o.order_no}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: "2px 0" }}>{o.item}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 15 }}>
            <b>ยอดที่ต้องโอน</b><b style={{ color: C.brand, fontSize: 20 }}>{baht(total)}</b>
          </div>
        </div>

        {rejected && (
          <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 10, padding: "10px 14px", fontWeight: 700 }}>
            ⚠ สลิปก่อนหน้าไม่ผ่านการตรวจสอบ — เหตุผล: {o.slip_reject_reason}<br />
            <span style={{ fontWeight: 400 }}>กรุณาตรวจสอบและแนบสลิปที่ถูกต้องอีกครั้ง</span>
          </div>
        )}
        {submitted ? (
          /* กติกา UX จาก prototype: บอก "รอตรวจ" — ห้ามบอกจ่ายสำเร็จ */
          <div style={{ ...card, textAlign: "center", border: `1.5px solid ${C.warn}`, background: C.warnBg }}>
            <div style={{ fontSize: 34 }}>🕐</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.warn, margin: "6px 0" }}>ส่งสลิปเรียบร้อย — รอตรวจสอบ</div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
              ทีมงานจะตรวจสลิปภายใน 4 ชั่วโมง<br />เมื่อยืนยันแล้ว เงินจะเข้าระบบฝากปลอดภัย (escrow) และผู้ขายจะเริ่มจัดส่ง
            </div>
            <Link href="/orders" style={{ display: "inline-block", marginTop: 14, background: C.brand, color: "#fff", padding: "10px 24px", borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
              ดูคำสั่งซื้อของฉัน
            </Link>
          </div>
        ) : (
          <>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>โอนเข้าบัญชีแพลตฟอร์ม</div>
              {config?.promptpay_enabled && config?.promptpay_id ? (
                <div style={{ background: C.brandTint, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: C.muted }}>พร้อมเพย์</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.brand, letterSpacing: .5 }}>{config.promptpay_id}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{config.promptpay_name || ""}</div>
                </div>
              ) : null}
              {config?.bank_enabled && banks.map((b, i) => (
                <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 14px", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: C.muted }}>{b.bank}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{b.accountNo}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{b.accountName}</div>
                </div>
              ))}
              {!config?.promptpay_id && !banks.length && (
                <div style={{ fontSize: 12.5, color: C.danger }}>⚠ ยังไม่ได้ตั้งค่าช่องทางรับเงินของแพลตฟอร์ม (ตั้งได้ใน platform_config)</div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>แนบสลิปโอนเงิน *</div>
              <input type="file" accept="image/*" onChange={pick} style={{ fontSize: 12.5 }} />
              {preview && <img src={preview} alt="สลิป" style={{ width: 160, borderRadius: 10, border: `1px solid ${C.line}`, marginTop: 10, display: "block" }} />}
              <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, margin: "12px 0 6px" }}>ยอดที่โอน (บาท)</div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                style={{ width: 180, height: 40, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 14, outline: "none" }} />
              {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}
              <button onClick={submit} disabled={busy}
                style={{ marginTop: 12, width: "100%", height: 48, border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
                {busy ? "กำลังส่งสลิป..." : "ส่งสลิปให้ตรวจสอบ"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
