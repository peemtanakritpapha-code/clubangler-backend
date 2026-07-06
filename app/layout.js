// app/layout.js — โครงหลักทั้งเว็บ: ฟอนต์จริงจาก prototype + เปลือกแอป/เว็บ
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import SwRegister from "@/components/SwRegister";

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "ClubAngler — ตลาดอุปกรณ์ตกปลา ซื้อขายผ่านระบบเงินฝากปลอดภัย",
  description: "ตลาดซื้อขายอุปกรณ์ตกปลา แบบมีคนกลางถือเงิน (escrow)",
};

// สีแถบเบราว์เซอร์บนมือถือ = สีแบรนด์ (มาตรฐาน PWA)
export const viewport = {
  themeColor: "#0E7E8C",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null, config = null, buyCount = 0, sellCount = 0;
  if (user) {
    // W3: badge เมนูโปรไฟล์ = จำนวนออเดอร์ที่ "รอเราขยับ" (ไม่ใช่นับทุกออเดอร์)
    //   ผู้ซื้อ:  pending_payment (จ่าย/แนบสลิปใหม่) · shipped (รอกดยืนยันรับ) · return_approved (ต้องส่งของกลับ)
    //   ผู้ขาย: payment_verified (เงินเข้า escrow รอส่งของ) · return_shipped (ของตีกลับถึง รอกดยืนยัน)
    const [{ data }, { count: b }, { count: s }] = await Promise.all([
      supabase.from("profiles").select("name, is_admin").eq("id", user.id).single(),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("buyer_id", user.id).in("status", ["pending_payment", "shipped", "return_approved"]),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("seller_id", user.id).in("status", ["payment_verified", "return_shipped"]),
    ]);
    profile = data;
    buyCount = b || 0;
    sellCount = s || 0;
  }
  const { data: cfg } = await supabase.from("platform_config").select("banner_enabled, banner_text").single();
  config = cfg;

  return (
    <html lang="th" className={plexThai.className}>
      <body>
        <SwRegister />
        <AppShell
          user={user ? { id: user.id, name: profile?.name || user.email, isAdmin: !!profile?.is_admin } : null}
          banner={config || {}}
          buyCount={buyCount}
          sellCount={sellCount}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
