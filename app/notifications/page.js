"use client";
// app/notifications/page.js — หน้ารวมการแจ้งเตือน (W5.7d — prototype WNoti บรรทัด 7646)
// pattern เดียวกับ NotiBell: อ่านตาราง notifications ของตัวเอง (RLS คุม) + เปิดหน้าแล้ว mark อ่านทั้งหมด
// หมายเหตุ: แถวไม่เป็นลิงก์ — ตารางไม่มีฟิลด์ปลายทาง (ref เป็นเลขออเดอร์เฉยๆ ไม่รู้ฝั่งซื้อ/ขาย) เดาพาไปผิดหน้าแย่กว่าไม่พาไป
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7" };

const ago = t => {
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 60) return "เมื่อครู่";
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) +
    " " + new Date(t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
};

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(null); // null = กำลังโหลด

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("notifications").select("*")
        .eq("to_user", user.id).order("created_at", { ascending: false }).limit(100);
      if (!alive) return;
      setItems(data || []);
      // เปิดหน้า = ถืออ่านหมด (พฤติกรรมเดียวกับกดกระดิ่ง)
      await supabase.from("notifications").update({ read: true }).eq("to_user", user.id).eq("read", false);
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link href="/" aria-label="กลับหน้าแรก" style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "grid", placeItems: "center", color: C.ink, textDecoration: "none", flex: "none", fontSize: 18 }}>‹</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>การแจ้งเตือน</div>
        </div>

        {items === null ? (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "60px 0" }}>กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "48px 16px", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.05)" }}>
            <Bell size={40} color={C.line} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>ยังไม่มีการแจ้งเตือน</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>ความเคลื่อนไหวของออเดอร์และบัญชีจะแสดงที่นี่</div>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,.05)" }}>
            {items.map((n, i) => (
              <div key={n.id} style={{ padding: "13px 16px", borderTop: i ? `1px solid ${C.line}` : "none", background: n.read ? "#fff" : "#F0F9FA", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ width: 38, height: 38, borderRadius: 999, background: C.brandTint, display: "grid", placeItems: "center", fontSize: 17, flex: "none" }}>{n.icon || "🔔"}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 1.6 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{n.ref ? `${n.ref} · ` : ""}{ago(n.created_at)}</div>
                </div>
                {!n.read && <span style={{ width: 9, height: 9, borderRadius: 999, background: C.brand, flex: "none", marginTop: 5 }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
