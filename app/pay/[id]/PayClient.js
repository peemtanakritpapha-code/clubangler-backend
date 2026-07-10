"use client";
// app/pay/[id]/PayClient.js — จ่ายเงิน/แนบสลิป
// A3 ก้าว 4: รองรับกลุ่มชำระ (pay_group) — โอนก้อนเดียว สลิปเดียว ติดทุกออเดอร์ในกลุ่ม
// ข้อความ/พฤติกรรมยกจาก prototype PaymentScreen (บรรทัด 2180–2327): จอหลังส่งสลิป = "รอตรวจสอบ" ห้ามบอกจ่ายสำเร็จ
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TimeLeft from "@/components/TimeLeft";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", warn: "#B7791F", warnBg: "#FEF6E7" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const payable = x => Number(x.price) + Number(x.buyer_fee || 0) + Number(x.ship_fee || 0);

export default function PayClient({ order: o, groupOrders, config, userId }) {
  const router = useRouter();
  const supabase = createClient();
  const orders = groupOrders && groupOrders.length > 1 ? groupOrders : [o];
  const isGroup = orders.length > 1;
  // ยอดที่ต้องโอน: กลุ่ม = group_total จาก DB (ยอดเดียวกันทุกออเดอร์) / เดี่ยว = ราคา+ค่าธรรมเนียม+ค่าส่ง
  const total = isGroup ? Number(o.group_total || orders.reduce((s, x) => s + payable(x), 0)) : payable(o);

  const pending = orders.filter(x => x.status === "pending_payment");
  const submitted = pending.length === 0;                 // ทุกออเดอร์ในกลุ่มส่งสลิปแล้ว (รอตรวจ/เลยขั้นนี้)
  const rejectedOrder = pending.find(x => x.slip_reject_reason);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [qrFail, setQrFail] = useState(false); // โหลด QR ไม่ได้ → โชว์เลขพร้อมเพย์ตามเดิม
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // ยกเลิกการสั่งซื้อ (เฉพาะก่อนแนบสลิป — API กันชั้นสุดท้ายอีกที) · กลุ่มชำระ = ยกเลิกทุกใบที่ยังรอชำระ
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const cancelAll = async () => {
    setErr(""); setCancelBusy(true);
    try {
      for (const x of pending) {
        const res = await fetch(`/api/orders/${x.id}/cancel`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "ยกเลิกไม่สำเร็จ");
      }
      router.push("/orders");
      router.refresh();
    } catch (e) { setErr(e.message || String(e)); setCancelBusy(false); setCancelOpen(false); }
  };

  // บันทึกรูป QR ลงเครื่อง (มือถือ: เซฟแล้วเปิดแอปธนาคาร → สแกนจากรูป)
  const qrUrl = config?.promptpay_id
    ? `https://promptpay.io/${encodeURIComponent(String(config.promptpay_id).replace(/[^0-9]/g, ""))}/${Number(total)}.png`
    : null;
  const [qrSaving, setQrSaving] = useState(false);
  const saveQr = async () => {
    if (!qrUrl || qrSaving) return;
    setQrSaving(true);
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ClubAngler-QR-${o.pay_group || o.order_no}-${Number(total)}บาท.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(qrUrl, "_blank"); // โหลด blob ไม่ได้ → เปิดรูปให้กดเซฟเอง
    }
    setQrSaving(false);
  };

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
      const path = `${userId}/${o.pay_group || o.order_no}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("slips").upload(path, file);
      if (upErr) throw upErr;
      // API จะกระจายสลิปนี้ให้ทุกออเดอร์ใน pay_group เดียวกันเอง
      const res = await fetch(`/api/orders/${o.id}/slip`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        // ยอดโอนส่งอัตโนมัติ = ยอดที่ต้องชำระ (เดิมให้ผู้ใช้พิมพ์เอง — แอดมินยังใช้เทียบยอดตอนตรวจสลิปเหมือนเดิม)
        body: JSON.stringify({ slipPath: path, transferAmount: total }),
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
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit", padding: "20px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/market" style={{ color: C.brand, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>‹ ตลาดสินค้า</Link>
          <div style={{ fontWeight: 800, color: C.brand }}>💳 ชำระเงิน</div>
        </div>

        <div style={card}>
          {isGroup ? (
            <>
              <div style={{ fontSize: 12, color: C.muted }}>กลุ่มชำระ {o.pay_group}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, margin: "2px 0 8px" }}>🧾 ชำระรวม {orders.length} รายการ — โอนก้อนเดียว สลิปเดียว</div>
              <div style={{ display: "grid", gap: 6 }}>
                {orders.map(x => (
                  <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, background: "#F6F9F9", borderRadius: 8, padding: "8px 11px", fontSize: 12.5 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <b style={{ color: C.ink }}>{x.item}</b> <span style={{ color: C.muted }}>· {x.order_no}</span>
                    </span>
                    <b style={{ color: C.ink, flex: "none" }}>{baht(payable(x))}</b>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.muted }}>คำสั่งซื้อ {o.order_no}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: "2px 0" }}>{o.item}</div>
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, fontSize: 15 }}>
            <b>ยอดที่ต้องชำระ{isGroup ? " (รวมทั้งกลุ่ม)" : ""}</b><b style={{ color: C.brand, fontSize: 20 }}>{baht(total)}</b>
          </div>
        </div>

        {!submitted && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFF8EC", border: "1px solid #F3E3C2", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#92400E", lineHeight: 1.55 }}>
            ⏳ <span>เหลือเวลาชำระ <TimeLeft startIso={o.created_at} minutes={Number(config?.pay_within_minutes) || 60} prefix="อีก" overdueText="หมดเวลาแล้ว — ระบบกำลังปิดออเดอร์" /> — โอนแล้วอย่าลืมแนบสลิปก่อนหมดเวลา</span>
          </div>
        )}
        {rejectedOrder && (
          <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 10, padding: "10px 14px", fontWeight: 700 }}>
            ⚠ สลิปก่อนหน้าไม่ผ่านการตรวจสอบ — เหตุผล: {rejectedOrder.slip_reject_reason}<br />
            <span style={{ fontWeight: 400 }}>กรุณาตรวจสอบและแนบสลิปที่ถูกต้องอีกครั้ง</span>
          </div>
        )}
        {submitted ? (
          /* กติกา UX จาก prototype: บอก "รอตรวจ" — ห้ามบอกจ่ายสำเร็จ */
          <div style={{ ...card, textAlign: "center", border: `1.5px solid ${C.warn}`, background: C.warnBg }}>
            <div style={{ fontSize: 34 }}>🕐</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.warn, margin: "6px 0" }}>ส่งสลิปเรียบร้อย — รอตรวจสอบ</div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
              ทีมงานจะตรวจสลิปภายใน 4 ชั่วโมง{isGroup ? ` (ตรวจครั้งเดียวครบทั้ง ${orders.length} รายการ)` : ""}<br />
              เมื่อยืนยันแล้ว เงินจะเข้าระบบฝากปลอดภัย (escrow) และผู้ขายจะเริ่มจัดส่ง
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
                <div style={{ background: C.brandTint, borderRadius: 10, padding: "14px", marginBottom: 8, textAlign: "center" }}>
                  {/* QR พร้อมเพย์ฝังยอดเงิน (มาตรฐาน EMVCo ผ่านบริการ promptpay.io) — โหลดไม่ได้ก็ยังโอนด้วยเลขได้ */}
                  {!qrFail && (
                    <img src={qrUrl}
                      alt={`QR พร้อมเพย์ ยอด ${baht(total)}`} onError={() => setQrFail(true)}
                      style={{ width: 190, height: 190, borderRadius: 12, background: "#fff", padding: 8, display: "block", margin: "0 auto 8px", boxSizing: "border-box" }} />
                  )}
                  {!qrFail && <div style={{ fontSize: 12.5, fontWeight: 800, color: C.brand, marginBottom: 8 }}>สแกนจ่ายยอด {baht(total)} ได้เลย — ยอดฝังใน QR แล้ว</div>}
                  {!qrFail && (
                    <button type="button" onClick={saveQr} disabled={qrSaving}
                      style={{ height: 38, padding: "0 20px", border: `1.5px solid ${C.brand}`, borderRadius: 999, background: "#fff", color: C.brand, fontWeight: 800, fontSize: 12.5, cursor: "pointer", marginBottom: 10, opacity: qrSaving ? .6 : 1 }}>
                      {qrSaving ? "กำลังบันทึก..." : "💾 บันทึกรูป QR"}
                    </button>
                  )}
                  {qrFail && (
                    <button type="button" onClick={() => setQrFail(false)}
                      style={{ height: 34, padding: "0 16px", border: `1px solid ${C.line}`, borderRadius: 999, background: "#fff", color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 8 }}>
                      ↻ ลองโหลด QR อีกครั้ง
                    </button>
                  )}
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
              <div style={{ fontSize: 11.5, color: C.muted, background: C.brandTint, borderRadius: 8, padding: "8px 12px", marginTop: 8 }}>
                โอน <b style={{ color: C.brand }}>{baht(total)}</b> ครั้งเดียว{isGroup ? ` — ระบบคุ้มครองแยกรายออเดอร์ทั้ง ${orders.length} ชิ้น` : ""}
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>แนบสลิปโอนเงิน *</div>
              {preview ? (
                <div style={{ position: "relative", width: 170 }}>
                  <img src={preview} alt="สลิป" style={{ width: 170, borderRadius: 12, border: `1px solid ${C.line}`, display: "block" }} />
                  <button type="button" onClick={() => { setFile(null); setPreview(""); }} aria-label="ลบสลิป"
                    style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", border: "2px solid #fff", background: C.danger, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>✕</button>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</div>
                </div>
              ) : (
                <label style={{ display: "grid", placeItems: "center", gap: 4, minHeight: 120, border: `1.5px dashed ${C.brand}`, borderRadius: 14, background: "#FAFDFD", cursor: "pointer", padding: 14 }}>
                  <span style={{ fontSize: 26 }}>🧾</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>แตะเพื่อเลือกรูปสลิป</span>
                  <span style={{ fontSize: 11, color: C.muted }}>รองรับรูปภาพจากแกลเลอรี่/ภาพหน้าจอแอปธนาคาร</span>
                  <input type="file" accept="image/*" onChange={pick} hidden />
                </label>
              )}
              {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}
              <button onClick={submit} disabled={busy}
                style={{ marginTop: 12, width: "100%", height: 48, border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
                {busy ? "กำลังส่งสลิป..." : "ส่งสลิปให้ตรวจสอบ"}
              </button>
              {/* ยกเลิกการสั่งซื้อ — ทำได้เฉพาะตอนยังไม่แนบสลิป (แนบแล้วต้องรอผลตรวจ) */}
              {!cancelOpen ? (
                <button type="button" onClick={() => setCancelOpen(true)} disabled={busy || cancelBusy}
                  style={{ marginTop: 10, width: "100%", height: 40, border: "none", borderRadius: 10, background: "transparent", color: C.danger, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  ยกเลิกการสั่งซื้อ
                </button>
              ) : (
                <div style={{ marginTop: 12, border: `1.5px solid #F3D6D2`, background: "#FDF6F5", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.danger, marginBottom: 4 }}>ยืนยันยกเลิกการสั่งซื้อ?</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
                    {isGroup ? `จะยกเลิกทั้ง ${pending.length} รายการที่ยังไม่ชำระในกลุ่มนี้` : "คำสั่งซื้อนี้จะถูกยกเลิก"} — สินค้าจะกลับมาว่างให้คนอื่นซื้อได้ทันที
                    {" "}หากโอนเงินไปแล้ว อย่ายกเลิก ให้แนบสลิปแทน
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" disabled={cancelBusy} onClick={() => setCancelOpen(false)}
                      style={{ flex: 1, height: 40, borderRadius: 9, border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      กลับไปชำระ
                    </button>
                    <button type="button" disabled={cancelBusy} onClick={cancelAll}
                      style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: C.danger, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: cancelBusy ? .6 : 1 }}>
                      {cancelBusy ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
