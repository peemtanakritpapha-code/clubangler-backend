"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const C = { brand: "#0E7E8C", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B" };

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false); // CONSENT-1: จุดยอมรับที่ 1

  const submit = async () => {
    setErr("");
    if (!email.trim() || !password) { setErr("กรอกอีเมลและรหัสผ่านให้ครบ"); return; }
    if (mode === "signup" && !name.trim()) { setErr("กรอกชื่อที่ใช้แสดง"); return; }
    if (mode === "signup" && !agree) { setErr("กรุณายอมรับกติกาการซื้อขายและข้อพิพาทก่อนสมัครสมาชิก"); return; }
    if (password.length < 6) { setErr("รหัสผ่านอย่างน้อย 6 ตัวอักษร"); return; }
    setBusy(true);
    const { error } = mode === "signup"
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      const map = {
        "Invalid login credentials": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        "User already registered": "อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบแทน",
      };
      setErr(map[error.message] || error.message);
      return;
    }
    if (mode === "signup") await fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ point: "signup" }) }).catch(() => {}); // CONSENT-1
    router.push("/");
    router.refresh();
  };

  const input = { width: "100%", height: 44, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 14px", fontSize: 14, boxSizing: "border-box", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center", padding: 20, fontFamily: "inherit" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 8px 30px rgba(0,0,0,.06)" }}>
        {/* NAV4: ทางกลับหน้าแรกสำหรับ guest — หน้า login ไม่มีเปลือก AppShell (แถบแท็บ/โลโก้) เลยต้องมีลิงก์เอง */}
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: C.muted, textDecoration: "none", marginBottom: 6 }}>‹ กลับหน้าแรก</Link>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 34 }}>🎣</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.brand }}>ClubAngler</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>ตลาดอุปกรณ์ตกปลา ซื้อขายผ่านระบบเงินฝากปลอดภัย</div>
        </div>

        <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 4, marginBottom: 18 }}>
          {[["login", "เข้าสู่ระบบ"], ["signup", "สมัครสมาชิก"]].map(([k, label]) => (
            <button key={k} onClick={() => { setMode(k); setErr(""); }}
              style={{ flex: 1, height: 36, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13,
                background: mode === k ? "#fff" : "transparent", color: mode === k ? C.brand : C.muted,
                boxShadow: mode === k ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {mode === "signup" && (
            <input style={input} placeholder="ชื่อที่ใช้แสดง เช่น ภีม นักตกปลา" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input style={input} type="email" placeholder="อีเมล" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={input} type="password" placeholder="รหัสผ่าน (6 ตัวขึ้นไป)" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          {err && <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}
          {mode === "signup" && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: C.ink, lineHeight: 1.6, cursor: "pointer" }}>
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ width: 17, height: 17, marginTop: 2, accentColor: C.brand, flexShrink: 0 }} />
              <span>ฉันได้อ่านและยอมรับ <Link href="/terms" style={{ color: C.brand, fontWeight: 700 }}>กติกาการซื้อขายและข้อพิพาท</Link> ของ ClubAngler</span>
            </label>
          )}
          <button onClick={submit} disabled={busy || (mode === "signup" && !agree)}
            style={{ height: 46, border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer", opacity: busy || (mode === "signup" && !agree) ? .6 : 1 }}>
            {busy ? "กำลังดำเนินการ..." : mode === "signup" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>
          {/* P2: การยอมรับข้อกำหนด — จำเป็นสำหรับสโตร์ */}
          <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center", lineHeight: 1.8 }}>
            การสมัครสมาชิกหรือเข้าสู่ระบบ ถือว่าคุณยอมรับ<br />
            <Link href="/terms" style={{ color: C.brand, fontWeight: 700 }}>ข้อกำหนดการใช้บริการ</Link>
            {" และ "}
            <Link href="/privacy" style={{ color: C.brand, fontWeight: 700 }}>นโยบายความเป็นส่วนตัว</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
