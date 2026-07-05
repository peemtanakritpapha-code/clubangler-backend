import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import NotiBell from "@/components/NotiBell";

const C = { brand: "#0E7E8C", ink: "#101314", muted: "#6B7678", bg: "#F4F7F7" };

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let profile = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("name, kyc_status, is_admin").eq("id", user.id).single();
    profile = data;
  }
  const btn = { display: "inline-block", background: C.brand, color: "#fff", padding: "12px 30px", borderRadius: 10, fontWeight: 800, fontSize: 14, textDecoration: "none" };
  const btnGhost = { ...btn, background: "#fff", color: C.brand, border: `1.5px solid ${C.brand}` };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px 40px", maxWidth: 460, width: "100%", boxShadow: "0 8px 30px rgba(0,0,0,.06)" }}>
        {user && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <NotiBell userId={user.id} />
          </div>
        )}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🎣</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.brand, margin: "8px 0 4px" }}>ClubAngler</h1>
          <p style={{ color: C.muted, fontSize: 13, margin: "6px 0 22px" }}>ตลาดซื้อขายอุปกรณ์ตกปลา แบบมีคนกลางถือเงิน</p>
          {user ? (
            <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
              <div style={{ fontSize: 14, color: C.ink, marginBottom: 4 }}>สวัสดี <b>{profile?.name || user.email}</b> 👋</div>
              <Link href="/market" style={btn}>🛒 เข้าตลาดสินค้า</Link>
              <Link href="/orders" style={btnGhost}>📦 คำสั่งซื้อของฉัน</Link>
              <Link href="/sell" style={btnGhost}>+ ลงขายสินค้า</Link>
              <Link href="/profile" style={{ ...btnGhost, border: "none", fontSize: 13 }}>โปรไฟล์ & สมุดที่อยู่</Link>
              {profile?.is_admin && <Link href="/admin" style={{ ...btnGhost, border: "none", fontSize: 13 }}>🛠 หลังบ้านแอดมิน</Link>}
              <LogoutButton />
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
              <Link href="/market" style={btn}>🛒 ดูตลาดสินค้า</Link>
              <Link href="/login" style={btnGhost}>เข้าสู่ระบบ / สมัครสมาชิก</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
