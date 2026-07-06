"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const BANKS = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "กรุงศรีอยุธยา", "ทหารไทยธนชาต (ttb)", "ออมสิน", "อื่นๆ"];

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B" };
const EMPTY = { label: "", name: "", phone: "", addr: "", sub: "", district: "", province: "", zip: "" };
const fmtAddr = a => [a.addr, a.sub && `ต.${a.sub}`, a.district && `อ.${a.district}`, a.province && `จ.${a.province}`, a.zip].filter(Boolean).join(" ");

export default function ProfileClient({ initialProfile, initialAddresses, userId, email }) {
  const supabase = createClient();
  const [profile, setProfile] = useState(initialProfile || {});
  const [addresses, setAddresses] = useState(initialAddresses);
  const [savedMsg, setSavedMsg] = useState("");
  const [form, setForm] = useState(null);      // null = ปิดฟอร์ม | {...EMPTY, id?} = เปิด
  const [showErr, setShowErr] = useState(false);
  const [busy, setBusy] = useState(false);

  /* ── ลบบัญชีถาวร (P1.2 — กติกา Apple 5.1.1) ── */
  const [showDelete, setShowDelete] = useState(false);
  const [delConfirm, setDelConfirm] = useState("");
  const [delErr, setDelErr] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  const deleteAccount = async () => {
    setDelErr("");
    if (delConfirm.trim() !== "ลบบัญชี") return setDelErr('พิมพ์คำว่า "ลบบัญชี" ให้ตรงก่อนยืนยัน');
    setDelBusy(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบบัญชีไม่สำเร็จ");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) { setDelErr(e.message || String(e)); setDelBusy(false); }
  };

  const reload = async () => {
    const { data } = await supabase.from("addresses").select("*")
      .eq("user_id", userId).order("is_default", { ascending: false }).order("id");
    setAddresses(data || []);
  };

  /* ── โปรไฟล์ ── */
  const saveProfile = async () => {
    setBusy(true);
    await supabase.from("profiles").update({ name: profile.name || "", phone: profile.phone || "" }).eq("id", userId);
    setBusy(false);
    setSavedMsg("บันทึกโปรไฟล์แล้ว ✓");
    setTimeout(() => setSavedMsg(""), 2500);
  };

  /* ── บัญชีรับเงิน + KYC ── */
  const [payee, setPayee] = useState({ promptpay: initialProfile?.promptpay || "", bank: initialProfile?.bank?.bank || BANKS[0], accNo: initialProfile?.bank?.no || "", accName: initialProfile?.bank?.name || "" });
  const [payeeMsg, setPayeeMsg] = useState("");
  const [idCard, setIdCard] = useState(null);
  const [bankBook, setBankBook] = useState(null);
  const [kycErr, setKycErr] = useState("");
  const [kycBusy, setKycBusy] = useState(false);

  const savePayee = async () => {
    setBusy(true);
    const bank = payee.accNo.trim() ? { bank: payee.bank, no: payee.accNo.trim(), name: payee.accName.trim() } : null;
    await supabase.from("profiles").update({ promptpay: payee.promptpay.trim() || null, bank }).eq("id", userId);
    setProfile(p => ({ ...p, promptpay: payee.promptpay.trim() || null, bank }));
    setBusy(false);
    setPayeeMsg("บันทึกบัญชีรับเงินแล้ว ✓");
    setTimeout(() => setPayeeMsg(""), 2500);
  };

  const submitKyc = async () => {
    setKycErr("");
    if (!payee.promptpay.trim() && !payee.accNo.trim()) return setKycErr("กรอกบัญชีรับเงินก่อน (พร้อมเพย์หรือบัญชีธนาคาร)");
    if (!idCard || !bankBook) return setKycErr("แนบเอกสารให้ครบทั้ง 2 รายการ");
    setKycBusy(true);
    try {
      await savePayee();
      const up = async (f, tag) => {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${tag}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("kyc").upload(path, f);
        if (error) throw error;
        return path;
      };
      const idCardPath = await up(idCard, "idcard");
      const bankBookPath = await up(bankBook, "bankbook");
      const res = await fetch("/api/kyc/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCardPath, bankBookPath }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ยื่นไม่สำเร็จ");
      setProfile(p => ({ ...p, kyc_status: "pending" }));
    } catch (e) { setKycErr(e.message || String(e)); }
    setKycBusy(false);
  };

  /* ── สมุดที่อยู่ ── */
  const REQUIRED = ["name", "phone", "addr", "sub", "district", "province", "zip"];
  const invalid = f => REQUIRED.filter(k => !String(f[k] || "").trim()).concat(/^[0-9]{5}$/.test(f.zip || "") ? [] : ["zip"]);

  const saveAddress = async () => {
    if (invalid(form).length) { setShowErr(true); return; }
    setBusy(true);
    const row = { ...form, user_id: userId, label: form.label || "ที่อยู่" };
    if (!addresses.length) row.is_default = true;   // ที่อยู่แรก = ค่าเริ่มต้นอัตโนมัติ
    if (form.id) {
      const { id, ...rest } = row;
      await supabase.from("addresses").update(rest).eq("id", id);
    } else {
      await supabase.from("addresses").insert(row);
    }
    await reload();
    setBusy(false); setForm(null); setShowErr(false);
  };

  const setDefault = async id => {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    await reload();
  };

  const removeAddress = async a => {
    if (!confirm(`ลบที่อยู่ "${a.label}" ?`)) return;
    await supabase.from("addresses").delete().eq("id", a.id);
    // ลบตัวเริ่มต้น → โอนให้ตัวถัดไป (กติกาจาก prototype)
    if (a.is_default) {
      const { data } = await supabase.from("addresses").select("id").eq("user_id", userId).order("id").limit(1);
      if (data?.length) await supabase.from("addresses").update({ is_default: true }).eq("id", data[0].id);
    }
    await reload();
  };

  const input = (k, ph, w) => (
    <input value={form[k] || ""} placeholder={ph}
      onChange={e => setForm({ ...form, [k]: e.target.value })}
      style={{ width: w || "100%", height: 40, borderRadius: 9, padding: "0 12px", fontSize: 13.5, boxSizing: "border-box", outline: "none",
        border: `1.5px solid ${showErr && invalid(form).includes(k) ? C.danger : C.line}` }} />
  );

  const card = { background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };
  const btn = (bg, fg, solid = true) => ({ height: 38, padding: "0 16px", borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
    background: solid ? bg : "#fff", color: solid ? fg : bg, border: solid ? "none" : `1px solid ${C.line}` });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ color: C.brand, fontSize: 13, textDecoration: "none", fontWeight: 700 }}>‹ กลับหน้าแรก</Link>
          <div style={{ fontWeight: 800, color: C.brand }}>🎣 โปรไฟล์ของฉัน</div>
        </div>

        {/* ── โปรไฟล์ ── */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginBottom: 12 }}>ข้อมูลส่วนตัว</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.muted }}>อีเมล: {email}</div>
            <input value={profile.name || ""} placeholder="ชื่อที่ใช้แสดง"
              onChange={e => setProfile({ ...profile, name: e.target.value })}
              style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 14, outline: "none" }} />
            <input value={profile.phone || ""} placeholder="เบอร์โทรศัพท์"
              onChange={e => setProfile({ ...profile, phone: e.target.value })}
              style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 14, outline: "none" }} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={saveProfile} disabled={busy} style={btn(C.brand, "#fff")}>บันทึกโปรไฟล์</button>
              {savedMsg && <span style={{ fontSize: 12.5, color: C.brand, fontWeight: 700 }}>{savedMsg}</span>}
            </div>
          </div>
        </div>

        {/* ── บัญชีรับเงิน & KYC ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>บัญชีรับเงิน & ยืนยันตัวตน</div>
            {{
              verified: <span style={{ background: "#F0FDF4", color: "#1E8E3E", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>✓ KYC ผ่านแล้ว</span>,
              pending: <span style={{ background: "#FEF6E7", color: "#B7791F", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>🕐 รอตรวจสอบ</span>,
              rejected: <span style={{ background: "#FBEAE8", color: C.danger, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>✕ ไม่ผ่าน</span>,
              none: <span style={{ background: "#F1F3F4", color: C.muted, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>ยังไม่ยืนยันตัวตน</span>,
            }[profile.kyc_status || "none"]}
          </div>

          {profile.payout_failed_note && (
            <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontWeight: 700 }}>
              🔁 โอนเงินให้คุณไม่สำเร็จ: {profile.payout_failed_note} — กรุณาตรวจสอบ/แก้ไขบัญชีด้านล่างแล้วบันทึก
            </div>
          )}
          {profile.kyc_status === "rejected" && profile.kyc_reject_reason && (
            <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
              เอกสารไม่ผ่าน — เหตุผล: {profile.kyc_reject_reason} · แก้ไขแล้วยื่นใหม่ได้ด้านล่าง
            </div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            <input value={payee.promptpay} placeholder="พร้อมเพย์ (เบอร์/เลขบัตร)" onChange={e => setPayee({ ...payee, promptpay: e.target.value })}
              style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13.5, outline: "none" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 }}>
              <select value={payee.bank} onChange={e => setPayee({ ...payee, bank: e.target.value })}
                style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 8px", fontSize: 13, background: "#fff" }}>
                {BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
              <input value={payee.accNo} placeholder="เลขบัญชี" onChange={e => setPayee({ ...payee, accNo: e.target.value })}
                style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13.5, outline: "none" }} />
            </div>
            <input value={payee.accName} placeholder="ชื่อบัญชี" onChange={e => setPayee({ ...payee, accName: e.target.value })}
              style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13.5, outline: "none" }} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={savePayee} disabled={busy} style={btn(C.brand, "#fff")}>บันทึกบัญชีรับเงิน</button>
              {payeeMsg && <span style={{ fontSize: 12.5, color: C.brand, fontWeight: 700 }}>{payeeMsg}</span>}
            </div>
          </div>

          {(profile.kyc_status === "none" || !profile.kyc_status || profile.kyc_status === "rejected") && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink }}>ยื่นยืนยันตัวตน (KYC) — จำเป็นสำหรับผู้ขาย</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>เอกสารเก็บในพื้นที่ปลอดภัย เห็นได้เฉพาะคุณและแอดมิน (ตาม PDPA)</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>1) รูปบัตรประชาชน *</div>
              <input type="file" accept="image/*" onChange={e => setIdCard(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>2) รูปหน้าสมุดบัญชี *</div>
              <input type="file" accept="image/*" onChange={e => setBankBook(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
              {kycErr && <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{kycErr}</div>}
              <button onClick={submitKyc} disabled={kycBusy}
                style={{ height: 44, border: "none", borderRadius: 9, background: "#B7791F", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", opacity: kycBusy ? .6 : 1 }}>
                {kycBusy ? "กำลังส่งเอกสาร..." : "🪪 ส่งเอกสารให้แอดมินตรวจ"}
              </button>
            </div>
          )}
          {profile.kyc_status === "pending" && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: "#B7791F", background: "#FEF6E7", borderRadius: 8, padding: "8px 12px" }}>
              🕐 เอกสารอยู่ระหว่างตรวจสอบ (ภายใน 24 ชม.)
            </div>
          )}
        </div>

        {/* ── สมุดที่อยู่ ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>สมุดที่อยู่ ({addresses.length})</div>
            {!form && <button onClick={() => { setForm({ ...EMPTY }); setShowErr(false); }} style={btn(C.brand, "#fff")}>+ เพิ่มที่อยู่</button>}
          </div>

          {form && (
            <div style={{ border: `1.5px solid ${C.brandTint}`, background: "#FAFDFD", borderRadius: 12, padding: 14, marginBottom: 14, display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: C.brand }}>{form.id ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่ใหม่"}</div>
              {input("label", "ชื่อเรียก เช่น บ้าน / ที่ทำงาน")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {input("name", "ชื่อผู้รับ *")}{input("phone", "เบอร์โทร *")}
              </div>
              {input("addr", "บ้านเลขที่ / ถนน / หมู่ *")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {input("sub", "ตำบล/แขวง *")}{input("district", "อำเภอ/เขต *")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {input("province", "จังหวัด *")}{input("zip", "รหัสไปรษณีย์ 5 หลัก *")}
              </div>
              {showErr && invalid(form).length > 0 &&
                <div style={{ fontSize: 12, color: C.danger }}>กรอกช่องที่มี * ให้ครบ (รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก)</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setForm(null); setShowErr(false); }} style={{ ...btn(C.ink, C.ink, false), flex: 1 }}>ยกเลิก</button>
                <button onClick={saveAddress} disabled={busy} style={{ ...btn(C.brand, "#fff"), flex: 2 }}>บันทึกที่อยู่</button>
              </div>
            </div>
          )}

          {addresses.length === 0 && !form && (
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "18px 0" }}>ยังไม่มีที่อยู่ — เพิ่มไว้ใช้ตอน checkout ได้เลย</div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {addresses.map(a => (
              <div key={a.id} style={{ border: `1.5px solid ${a.is_default ? C.brand : C.line}`, borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: C.ink }}>
                    {a.label}{" "}
                    {a.is_default && <span style={{ background: C.brandTint, color: C.brand, fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>ค่าเริ่มต้น</span>}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: C.ink }}>{a.name} · {a.phone}</div>
                <div style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 8px" }}>{fmtAddr(a)}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {!a.is_default && <button onClick={() => setDefault(a.id)} style={btn(C.brand, C.brand, false)}>ตั้งเป็นค่าเริ่มต้น</button>}
                  <button onClick={() => { setForm({ ...a }); setShowErr(false); }} style={btn(C.ink, C.ink, false)}>แก้ไข</button>
                  <button onClick={() => removeAddress(a)} style={btn(C.danger, C.danger, false)}>ลบ</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── โซนอันตราย: ลบบัญชี (P1.2 — กติกา Apple 5.1.1) ── */}
        <div style={{ ...card, border: "1.5px solid #F3D6D2" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.danger, marginBottom: 6 }}>โซนอันตราย</div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>
            ลบบัญชีถาวร — ข้อมูลส่วนตัว สินค้าที่ลงขาย โพสต์ และเอกสารยืนยันตัวตนจะถูกลบทั้งหมด กู้คืนไม่ได้
            (ประวัติออเดอร์ที่จบแล้วจะถูกเก็บไว้แบบไม่ระบุตัวตน ตามความจำเป็นทางบัญชี)
          </div>
          <button onClick={() => { setShowDelete(true); setDelConfirm(""); setDelErr(""); }} style={btn(C.danger, C.danger, false)}>
            ลบบัญชีถาวร...
          </button>
        </div>

        {showDelete && (
          <div onClick={() => !delBusy && setShowDelete(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420, boxSizing: "border-box" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.danger, marginBottom: 8 }}>⚠️ ยืนยันลบบัญชีถาวร</div>
              <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.7, marginBottom: 10 }}>
                หากยังมีออเดอร์ที่ไม่จบ ระบบจะไม่ให้ลบ (ตรวจให้อัตโนมัติ) และเมื่อลบแล้ว <b>กู้คืนไม่ได้ทุกกรณี</b>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
                พิมพ์คำว่า <b style={{ color: C.danger }}>ลบบัญชี</b> เพื่อยืนยัน
              </div>
              <input value={delConfirm} onChange={e => setDelConfirm(e.target.value)} placeholder="ลบบัญชี"
                style={{ width: "100%", height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              {delErr && <div style={{ marginTop: 8, fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{delErr}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button disabled={delBusy} onClick={() => setShowDelete(false)} style={{ ...btn(C.ink, C.ink, false), flex: 1 }}>ยกเลิก</button>
                <button disabled={delBusy || delConfirm.trim() !== "ลบบัญชี"} onClick={deleteAccount}
                  style={{ ...btn(C.danger, "#fff"), flex: 1, opacity: delBusy || delConfirm.trim() !== "ลบบัญชี" ? .55 : 1 }}>
                  {delBusy ? "กำลังลบ..." : "ลบบัญชีถาวร"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
