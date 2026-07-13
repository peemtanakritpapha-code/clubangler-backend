"use client";
// components/AppShell.js — เปลือก 2 ร่างจาก prototype:
// จอแคบ = ทรงแอป (header + tabbar ล่าง) · จอกว้าง = ทรงเว็บ (เมนูบน)
// W3: nav ฟีด/ตลาด/ลงขาย ลอยกึ่งกลางบราวเซอร์ + เมนูโปรไฟล์แบบ dropdown ตาม prototype
//     (หัวการ์ด + ดูโปรไฟล์สาธารณะ / การซื้อ-การขาย (รองรับ badge) / สินค้าที่ลงขาย / ตั้งค่า / KYC / ออกจากระบบ)
// หมายเหตุ: ออกจากระบบใช้ตรรกะเดียวกับ components/LogoutButton.js (signOut → /login) — ตัวปุ่มเดิมยังใช้ที่หน้าโปรไฟล์
// NAV1 (v14.1): มือถือ — แท็บโปรไฟล์ชี้หน้าโปรไฟล์สาธารณะของตัวเอง (/seller/[id]) แทน /profile
//               + avatar มุมขวาบนทุกหน้า เปิด bottom sheet เมนูบัญชี (รายการเดียวกับ dropdown เว็บ รวมออกจากระบบ)
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Store, Plus, ShoppingCart, User, Wrench, Bell, Globe, ChevronDown, ShoppingBag, Package, Settings, Wallet, X } from "lucide-react";
import NotiBell from "@/components/NotiBell";
import PullToRefresh from "@/components/PullToRefresh"; // PTR1: ปัดลงรีเฟรช (เฉพาะแอพ/PWA)
import { createClient } from "@/lib/supabase/client";
import { getCart, subscribeCart } from "@/lib/cart";

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC", danger: "#C24D42" };

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

// W4: โลโก้ header = ไอคอนแอปตัวเดียวกัน (public/icon-192.png จาก P1) — เว็บกับแอปเข้าชุดกัน
const Logo = ({ size = 20 }) => (
  <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
    <img src="/icon-192.png" alt="ClubAngler" width={size + 12} height={size + 12}
      style={{ borderRadius: 10, display: "block", flex: "none" }} />
    <b style={{ fontSize: size, color: C.brand }}>ClubAngler</b>
    <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 8px" }}>Beta</span>
  </Link>
);

const iconBtn = { width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", display: "grid", placeItems: "center", color: C.ink };
const thPill = { display: "inline-flex", alignItems: "center", gap: 5, height: 40, padding: "0 13px", borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", color: C.muted, fontSize: 12.5, fontWeight: 700 };

/* แถวเมนูใน dropdown โปรไฟล์ (prototype: ไอคอนพื้นอ่อน + ข้อความ + badge ตัวเลข) — ใช้ร่วมกับ bottom sheet มือถือ (NAV1) */
function MenuRow({ icon: Icon, label, href, onClick, badge, danger, dark }) {
  const inner = (
    <>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: danger ? "#FBEAE8" : dark ? "#1F2937" : C.brandTint, color: danger ? C.danger : dark ? "#fff" : C.brand, display: "grid", placeItems: "center", flex: "none" }}>
        <Icon size={16} />
      </span>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: danger ? C.danger : C.ink }}>{label}</span>
      {badge > 0 && (
        <span style={{ minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, background: C.danger, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
      )}
    </>
  );
  const rowStyle = { display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", textDecoration: "none", cursor: "pointer", borderTop: `1px solid ${C.line}` };
  return href
    ? <Link href={href} onClick={onClick} style={rowStyle}>{inner}</Link>
    : <div onClick={onClick} style={rowStyle}>{inner}</div>;
}

// NAV5: หน้าโปรไฟล์ในวงกลม — มีรูป (user.avatar จาก layout) ใช้รูป ไม่มีใช้อักษรย่อ
// ใช้ซ้ำ 4 จุด: ปุ่มมุมขวาบนเว็บ / หัว dropdown / ปุ่มมุมขวาบนมือถือ / หัว bottom sheet
function AvatarFace({ user }) {
  return user?.avatar
    ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 999, display: "block" }} />
    : (user?.name || "?").trim().charAt(0).toUpperCase();
}

export default function AppShell({ user, banner, children, buyCount = 0, sellCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  // NAV1: bottom sheet เมนูบัญชีฝั่งมือถือ (แยก state จาก dropdown เว็บ)
  const [sheetOpen, setSheetOpen] = useState(false);
  // badge ตะกร้า (A3 เดิม — คืนชีพใน W5.7): นับใน useEffect เพื่อให้ render แรก deterministic
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const update = () => setCartCount(getCart().length);
    update();
    return subscribeCart(update);
  }, []);
  // NAV1: เปลี่ยนหน้าเมื่อไรก็ปิดเมนูทั้งสองแบบ (กันเมนูค้างหลังนำทาง)
  useEffect(() => { setMenuOpen(false); setSheetOpen(false); }, [pathname]);
  const CartBadge = () => cartCount > 0 ? (
    <span style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: "#C24D42", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{cartCount}</span>
  ) : null;
  const closeMenu = () => setMenuOpen(false);
  const closeSheet = () => setSheetOpen(false);
  const logout = async () => {
    closeMenu();
    closeSheet();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // หน้าที่ไม่ใส่เปลือก: login + หลังบ้านแอดมิน (มีโครงของตัวเอง)
  if (pathname.startsWith("/login") || pathname.startsWith("/admin")) return children;

  // NAV1 (M1): แท็บโปรไฟล์ → หน้าโปรไฟล์สาธารณะของตัวเอง (guest → login) · หน้า /profile (ตั้งค่าบัญชี) เข้าผ่านเมนูใน sheet
  const profileHref = user ? `/seller/${user.id}` : "/login";
  const TABS = [
    { href: "/",        label: "ฟีด",     icon: LayoutGrid },
    { href: "/market",  label: "ตลาด",    icon: Store },
    { href: "/sell",    label: "",        icon: Plus, big: true },
    { href: "/cart",    label: "ตะกร้า",  icon: ShoppingCart },
    { href: profileHref, label: "โปรไฟล์", icon: User },
  ];
  const active = href => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const webLink = href => ({
    padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none",
    color: active(href) ? C.brand : C.muted, background: active(href) ? C.brandTint : "transparent",
  });

  return (
    <>
      <PullToRefresh />
      {/* APPFIX2: แถบขาวปิดหลังแถบสถานะ iOS (สูง 0 บนเบราว์เซอร์) */}
      <div className="safe-top-strip" />
      {/* ── ทรงเว็บ (จอกว้าง) ── */}
      <div className="shell-web" style={{ position: "sticky", top: "env(safe-area-inset-top)", zIndex: 30, background: "#fff", borderBottom: `1px solid ${C.line}`, alignItems: "center", gap: 14, padding: "10px 22px" }}>
        <Logo size={19} />
        {/* W3: nav ลอยกึ่งกลางบราวเซอร์ตาม prototype */}
        <nav style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
          <Link href="/" style={webLink("/")}>ฟีด</Link>
          <Link href="/market" style={webLink("/market")}>ตลาด</Link>
          <Link href="/sell" style={webLink("/sell")}>ลงขายสินค้า</Link>
        </nav>
        <div style={{ flex: 1 }} />
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
            <NotiBell userId={user.id} />
            <Link href="/cart" title="ตะกร้า" style={{ ...iconBtn, position: "relative" }}><ShoppingCart size={17} /><CartBadge /></Link>
            <span title="ภาษาไทย (English เร็วๆ นี้)" style={thPill}><Globe size={15} /> TH</span>
            {user.isAdmin && (
              <Link href="/admin" title="หลังบ้านแอดมิน" style={iconBtn}><Wrench size={16} /></Link>
            )}
            {/* อวตาร + ˅ เปิดเมนูโปรไฟล์ (prototype) */}
            <div onClick={() => setMenuOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", background: menuOpen ? C.brandTint : "transparent", borderRadius: 999, padding: "4px 8px 4px 4px" }}>
              <span style={{ width: 34, height: 34, borderRadius: 999, background: C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 13.5, fontWeight: 800, flex: "none", overflow: "hidden" }}>
                <AvatarFace user={user} />
              </span>
              <ChevronDown size={15} color={C.muted} style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </div>

            {/* เมนูโปรไฟล์ dropdown */}
            {menuOpen && (
              <>
                <div onClick={closeMenu} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 300, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 12px 34px rgba(0,0,0,.13)", overflow: "hidden", zIndex: 50 }}>
                  {/* หัวการ์ด: ชื่อ + ดูโปรไฟล์สาธารณะ */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px 12px" }}>
                    <span style={{ width: 46, height: 46, borderRadius: 999, background: C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 800, flex: "none", overflow: "hidden" }}>
                      <AvatarFace user={user} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                      <Link href={`/seller/${user.id}`} onClick={closeMenu} style={{ fontSize: 11.5, fontWeight: 700, color: C.brand, textDecoration: "none" }}>ดูโปรไฟล์สาธารณะของฉัน →</Link>
                    </div>
                  </div>
                  <MenuRow icon={User} label="โปรไฟล์ของฉัน" href={`/seller/${user.id}`} onClick={closeMenu} />
                  <MenuRow icon={ShoppingBag} label="การซื้อของฉัน" href="/orders?role=buy" onClick={closeMenu} badge={buyCount} />
                  <MenuRow icon={Package} label="การขายของฉัน" href="/orders?role=sell" onClick={closeMenu} badge={sellCount} />
                  <MenuRow icon={Store} label="สินค้าที่ลงขาย" href="/my-products" onClick={closeMenu} />
                  <MenuRow icon={Settings} label="ตั้งค่าบัญชี" href="/profile" onClick={closeMenu} />
                  <MenuRow icon={Wallet} label="บัญชีรับเงิน & ยืนยันตัวตน" href="/kyc" onClick={closeMenu} />
                  <MenuRow icon={X} label="ออกจากระบบ" onClick={logout} danger />
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* W2.1: แถบขวา guest ตาม prototype โหมดเว็บ — กระดิ่ง/ตะกร้า/ป้ายภาษา */}
            <Link href="/login" title="เข้าสู่ระบบเพื่อดูการแจ้งเตือน" style={iconBtn}><Bell size={17} /></Link>
            <Link href="/cart" title="ตะกร้า" style={{ ...iconBtn, position: "relative" }}><ShoppingCart size={17} /><CartBadge /></Link>
            <span title="ภาษาไทย (English เร็วๆ นี้)" style={thPill}><Globe size={15} /> TH</span>
            <Link href="/login" style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#F1F3F4", fontSize: 13.5, fontWeight: 700, textDecoration: "none", color: C.ink }}>เข้าสู่ระบบ</Link>
            <Link href="/login" style={{ padding: "9px 18px", borderRadius: 10, background: C.brand, color: "#fff", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>สมัครสมาชิก</Link>
          </div>
        )}
      </div>

      {/* ── ทรงแอป: header บน (จอแคบ) ── */}
      <div className="shell-mobile-top" style={{ position: "sticky", top: "env(safe-area-inset-top)", zIndex: 30, background: "#fff", borderBottom: `1px solid ${C.line}`, alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
        <Logo size={17} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {user ? (
            <>
              <NotiBell userId={user.id} />
              {/* NAV1 (M4): avatar มุมขวาบน ทุกหน้า — บอกสถานะล็อกอิน + เปิดเมนูบัญชี */}
              <button onClick={() => setSheetOpen(true)} aria-label="เมนูบัญชี"
                style={{ width: 36, height: 36, borderRadius: 999, background: C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800, border: "none", padding: 0, cursor: "pointer", overflow: "hidden" }}>
                <AvatarFace user={user} />
              </button>
            </>
          ) : (
            <Link href="/login" style={{ padding: "8px 14px", borderRadius: 999, background: C.brand, color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>เข้าสู่ระบบ</Link>
          )}
        </div>
      </div>

      <AnnouncementBanner banner={banner} />

      <div className="shell-content">{children}</div>

      {/* ── NAV1 (M2+M5): bottom sheet เมนูบัญชี (จอแคบ) — รายการเดียวกับ dropdown เว็บ ── */}
      {sheetOpen && user && (
        <>
          <style>{`@keyframes caSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
          <div onClick={closeSheet} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.38)" }} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61, background: "#fff", borderRadius: "18px 18px 0 0", boxShadow: "0 -10px 34px rgba(0,0,0,.18)", paddingBottom: "calc(8px + env(safe-area-inset-bottom))", animation: "caSheetUp .22s ease" }}>
            {/* ขีดจับด้านบนตามภาษามือถือ */}
            <div style={{ width: 40, height: 4, borderRadius: 999, background: C.line, margin: "8px auto 2px" }} />
            {/* หัวการ์ด: ชื่อ + ดูโปรไฟล์สาธารณะ (ชุดเดียวกับ dropdown เว็บ) */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px 12px" }}>
              <span style={{ width: 46, height: 46, borderRadius: 999, background: C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 800, flex: "none", overflow: "hidden" }}>
                <AvatarFace user={user} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                <Link href={`/seller/${user.id}`} onClick={closeSheet} style={{ fontSize: 11.5, fontWeight: 700, color: C.brand, textDecoration: "none" }}>ดูโปรไฟล์สาธารณะของฉัน →</Link>
              </div>
            </div>
            <MenuRow icon={User} label="โปรไฟล์ของฉัน" href={`/seller/${user.id}`} onClick={closeSheet} />
            <MenuRow icon={ShoppingBag} label="การซื้อของฉัน" href="/orders?role=buy" onClick={closeSheet} badge={buyCount} />
            <MenuRow icon={Package} label="การขายของฉัน" href="/orders?role=sell" onClick={closeSheet} badge={sellCount} />
            <MenuRow icon={Store} label="สินค้าที่ลงขาย" href="/my-products" onClick={closeSheet} />
            <MenuRow icon={Settings} label="ตั้งค่าบัญชี" href="/profile" onClick={closeSheet} />
            <MenuRow icon={Wallet} label="บัญชีรับเงิน & ยืนยันตัวตน" href="/kyc" onClick={closeSheet} />
            {/* NAV2: ทางเข้าหลังบ้านบนมือถือ — เห็นเฉพาะแอดมิน (สิทธิ์จริงกันที่ /admin ฝั่งเซิร์ฟเวอร์) */}
            {user.isAdmin && <MenuRow icon={Wrench} label="หลังบ้านแอดมิน" href="/admin" onClick={closeSheet} dark />}
            <MenuRow icon={X} label="ออกจากระบบ" onClick={logout} danger />
          </div>
        </>
      )}

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
              <span style={{ position: "relative", display: "inline-flex" }}>
                <Icon size={20} strokeWidth={on ? 2.4 : 2} />
                {t.href === "/cart" && <CartBadge />}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: on ? 800 : 600 }}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
