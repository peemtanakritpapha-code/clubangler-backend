// app/layout.js — โครงหลักทั้งเว็บ: ฟอนต์ Prompt ทั้งแอป (self-host ผ่าน next/font) + เปลือกแอป/เว็บ
import { Prompt } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import SwRegister from "@/components/SwRegister";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "ClubAngler — ตลาดอุปกรณ์ตกปลา ซื้อขายผ่านระบบเงินฝากปลอดภัย",
  description: "ตลาดซื้อขายอุปกรณ์ตกปลา แบบมีคนกลางถือเงิน (escrow)",
};

// สีแถบเบราว์เซอร์บนมือถือ = สีแบรนด์ (มาตรฐาน PWA)
// APPFIX1: maximumScale=1 กัน iOS auto-zoom ตอนแตะ input ตัวหนังสือ <16px (ต้นเหตุจอซูมค้าง/โดนตัดข้างใน App Review)
//   — ตั้งแต่ iOS 10 ค่านี้ไม่ปิดการถ่างนิ้วซูมของผู้ใช้ ปิดแค่ auto-zoom · viewportFit=cover เปิดใช้ env(safe-area-inset-*)
export const viewport = {
  themeColor: "#0E7E8C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
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
      supabase.from("profiles").select("name, is_admin, avatar_path").eq("id", user.id).single(),
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
    <html lang="th" className={prompt.className}>
      <body>
        <SwRegister />
        <AppShell
          user={user ? { id: user.id, name: profile?.name || user.email, isAdmin: !!profile?.is_admin, avatar: profile?.avatar_path || null } : null}
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
