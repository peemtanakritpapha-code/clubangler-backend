"use client";
// components/AppShell.js — เปลือก 2 ร่างจาก prototype:
// จอแคบ = ทรงแอป (header + tabbar ล่าง) · จอกว้าง = ทรงเว็บ (เมนูบน)
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid, Store, Plus, ShoppingCart, User, Wrench } from "lucide-react";
import NotiBell from "@/components/NotiBell";
import { subscribeCart } from "@/lib/cart";

/* badge เลขแดงมุมไอคอนตะกร้า — ยกจาก prototype WNav บรรทัด 6160–6162 */
function CartBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, padding: "0 4px", boxSizing: "border-box", background: "#C0392B", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
  );
}

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC" };

/* แบนเนอร์ประกาศตัววิ่ง — ยกจาก prototype (ควบคุมจาก platform_config) */
function AnnouncementBanner({ banner }) {
  const t = (banner?.banner_text || "").trim();
  if (!banner?.banner_enabled || !t) return null;
  const dur = Math.max(14, Math.round(t.length * 0.45));
  const Group = () => (
    <div style={{ display: "flex", flex: "none" }}>
      {[0, 1, 2].map(i => <span key={i} style={{ fontSize: 12.5, fontWeight: 600, padding: "0 44px", whiteSpace: "nowrap" }}>{t}</span>)}
    </div>
  );
  return (
    <div style={{ background: C.brand, color: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", width: "max-content", padding: "8px 0", animation: `marqueeX ${dur}s linear infinite`, willChange: "transform" }}>
        <Group /><Group />
      </div>
    </div>
  );
}

const Logo = ({ size = 20 }) => (
  <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
    <span style={{ width: size + 12, height: size + 12, borderRadius: 10, background: C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: size - 4 }}>🎣</span>
    <b style={{ fontSize: size, color: C.brand }}>ClubAngler</b>
    <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 8px" }}>Beta</span>
  </Link>
);

export default function AppShell({ user, banner, children }) {
  const pathname = usePathname();
  const [cartN, setCartN] = useState(0);
  useEffect(() => subscribeCart(setCartN), []);

  // หน้าที่ไม่ใส่เปลือก: login + หลังบ้านแอดมิน (มีโครงของตัวเอง)
  if (pathname.startsWith("/login") || pathname.startsWith("/admin")) return children;

  const TABS = [
    { href: "/",        label: "ฟีด",     icon: LayoutGrid },
    { href: "/market",  label: "ตลาด",    icon: Store },
    { href: "/sell",    label: "",        icon: Plus, big: true },
    { href: "/cart",    label: "ตะกร้า",  icon: ShoppingCart },
    { href: "/profile", label: "โปรไฟล์", icon: User },
  ];
  const active = href => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const webLink = href => ({
    padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none",
    color: active(href) ? C.brand : C.muted, background: active(href) ? C.brandTint : "transparent",
  });

  return (
    <>
      {/* ── ทรงเว็บ (จอกว้าง) ── */}
      <div className="shell-web" style={{ position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: `1px solid ${C.line}`, alignItems: "center", gap: 14, padding: "10px 22px" }}>
        <Logo size={19} />
        <nav style={{ display: "flex", gap: 4, marginLeft: 10 }}>
          <Link href="/" style={webLink("/")}>ฟีด</Link>
          <Link href="/market" style={webLink("/market")}>ตลาด</Link>
          <Link href="/sell" style={webLink("/sell")}>ลงขายสินค้า</Link>
        </nav>
        <div style={{ flex: 1 }} />
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <NotiBell userId={user.id} />
            <Link href="/cart" title="ตะกร้า" style={{ position: "relative", width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", display: "grid", placeItems: "center", color: C.ink }}>
              <ShoppingCart size={17} />
              <CartBadge count={cartN} />
            </Link>
            {user.isAdmin && (
              <Link href="/admin" title="หลังบ้านแอดมิน" style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", display: "grid", placeItems: "center", color: C.ink }}>
                <Wrench size={16} />
              </Link>
            )}
            <Link href="/orders" style={{ fontSize: 13, fontWeight: 700, color: C.muted, textDecoration: "none" }}>📦 ออเดอร์</Link>
            <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", background: C.brandTint, borderRadius: 999, padding: "6px 14px 6px 6px" }}>
              <span style={{ width: 28, height: 28, borderRadius: 999, background: C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 800 }}>
                {(user.name || "?").trim().charAt(0).toUpperCase()}
              </span>
              <b style={{ fontSize: 13, color: C.brand, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</b>
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/login" style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#F1F3F4", fontSize: 13.5, fontWeight: 700, textDecoration: "none", color: C.ink }}>เข้าสู่ระบบ</Link>
            <Link href="/login" style={{ padding: "9px 18px", borderRadius: 10, background: C.brand, color: "#fff", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>สมัครสมาชิก</Link>
          </div>
        )}
      </div>

      {/* ── ทรงแอป: header บน (จอแคบ) ── */}
      <div className="shell-mobile-top" style={{ position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: `1px solid ${C.line}`, alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
        <Logo size={17} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {user ? <NotiBell userId={user.id} /> : (
            <Link href="/login" style={{ padding: "8px 14px", borderRadius: 999, background: C.brand, color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>เข้าสู่ระบบ</Link>
          )}
        </div>
      </div>

      <AnnouncementBanner banner={banner} />

      <div className="shell-content">{children}</div>

      {/* ── ทรงแอป: tabbar ล่าง (จอแคบ) ── */}
      <nav className="shell-tabbar" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: "#fff", borderTop: `1px solid ${C.line}`, justifyContent: "space-around", alignItems: "center", padding: "6px 4px calc(6px + env(safe-area-inset-bottom))" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          if (t.big) return (
            <Link key={t.href} href={t.href} aria-label="ลงขายสินค้า"
              style={{ width: 52, height: 52, borderRadius: 999, background: C.brand, color: "#fff", display: "grid", placeItems: "center", marginTop: -22, boxShadow: "0 6px 16px rgba(14,126,140,.4)", textDecoration: "none" }}>
              <Icon size={24} />
            </Link>
          );
          const on = active(t.href);
          return (
            <Link key={t.href} href={t.href} style={{ display: "grid", justifyItems: "center", gap: 2, textDecoration: "none", color: on ? C.brand : C.muted, minWidth: 56 }}>
              <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
                <Icon size={20} strokeWidth={on ? 2.4 : 2} />
                {t.href === "/cart" ? <CartBadge count={cartN} /> : null}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: on ? 800 : 600 }}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
