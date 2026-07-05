// app/page.js — หน้าแรกชั่วคราวใต้เปลือกใหม่ (A2 จะกลายเป็นฟีดชุมชนเต็มรูป)
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC" };

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let name = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    name = data?.name;
  }
  const { data: latest } = await supabase.from("products")
    .select("id, name, price, images").eq("status", "active")
    .order("created_at", { ascending: false }).limit(6);

  const tile = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 14px", textDecoration: "none", display: "grid", gap: 4 };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <div style={{ fontSize: 13, color: C.muted, margin: "4px 0 2px" }}>สวัสดี{name ? `, ${name}` : ""} 👋</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: "0 0 14px" }}>ตลาดอุปกรณ์ตกปลา</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Link href="/market" style={tile}><span style={{ fontSize: 22 }}>🛒</span><b style={{ fontSize: 13.5, color: C.ink }}>เข้าตลาดสินค้า</b><span style={{ fontSize: 11.5, color: C.muted }}>ค้นหาคัน รอก เหยื่อ</span></Link>
        <Link href="/sell" style={tile}><span style={{ fontSize: 22 }}>🏷️</span><b style={{ fontSize: 13.5, color: C.ink }}>ลงขายสินค้า</b><span style={{ fontSize: 11.5, color: C.muted }}>เห็นยอดรับสุทธิทันที</span></Link>
        <Link href="/orders" style={tile}><span style={{ fontSize: 22 }}>📦</span><b style={{ fontSize: 13.5, color: C.ink }}>คำสั่งซื้อของฉัน</b><span style={{ fontSize: 11.5, color: C.muted }}>ติดตามทุกสถานะ escrow</span></Link>
        <Link href="/profile" style={tile}><span style={{ fontSize: 22 }}>👤</span><b style={{ fontSize: 13.5, color: C.ink }}>โปรไฟล์ & KYC</b><span style={{ fontSize: 11.5, color: C.muted }}>บัญชีรับเงิน สมุดที่อยู่</span></Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <b style={{ fontSize: 15.5, color: C.ink }}>สินค้ามาใหม่</b>
        <Link href="/market" style={{ fontSize: 12.5, fontWeight: 700, color: C.brand, textDecoration: "none" }}>ดูทั้งหมด ›</Link>
      </div>
      {(!latest || latest.length === 0) ? (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "30px 0" }}>
          ยังไม่มีสินค้า — <Link href="/sell" style={{ color: C.brand, fontWeight: 800 }}>เป็นคนแรกที่ลงขายเลย</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {latest.map(p => (
            <Link key={p.id} href={`/product/${p.id}`} style={{ textDecoration: "none", background: "#fff", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
              <div style={{ aspectRatio: "1/1", background: "#EDF2F2" }}>
                {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, height: 32, overflow: "hidden" }}>{p.name}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.brand }}>฿{Number(p.price).toLocaleString()}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div style={{ marginTop: 22, fontSize: 11.5, color: C.muted, textAlign: "center" }}>
        🛡 ทุกออเดอร์ผ่านระบบเงินฝากปลอดภัย (escrow) — ผู้ขายได้เงินเมื่อผู้ซื้อยืนยันรับสินค้า
      </div>
    </div>
  );
}
