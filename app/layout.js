// app/layout.js — โครงหลักทั้งเว็บ: ฟอนต์จริงจาก prototype + เปลือกแอป/เว็บ
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "ClubAngler — ตลาดอุปกรณ์ตกปลา ซื้อขายผ่านระบบเงินฝากปลอดภัย",
  description: "ตลาดซื้อขายอุปกรณ์ตกปลา แบบมีคนกลางถือเงิน (escrow)",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null, config = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("name, is_admin").eq("id", user.id).single();
    profile = data;
  }
  const { data: cfg } = await supabase.from("platform_config").select("banner_enabled, banner_text").single();
  config = cfg;

  return (
    <html lang="th" className={plexThai.className}>
      <body>
        <AppShell
          user={user ? { id: user.id, name: profile?.name || user.email, isAdmin: !!profile?.is_admin } : null}
          banner={config || {}}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
