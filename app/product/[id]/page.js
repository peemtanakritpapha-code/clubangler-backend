import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddToCartBar from "@/components/AddToCartBar";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7" };
const baht = n => "฿" + Number(n || 0).toLocaleString();

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("*").eq("id", id).single();
  if (!p) notFound();
  const { data: seller } = await supabase.from("profiles").select("name, kyc_status").eq("id", p.seller_id).single();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user && user.id === p.seller_id;
  const canBuy = p.status === "active" && !isOwner;

  // A4: ตัวนับวิว — นับเมื่อคนอื่นเปิดดู (เจ้าของดูเองไม่นับ) ผ่านฟังก์ชัน DB จากก้าว 0
  if (!isOwner) await supabase.rpc("increment_product_views", { pid: Number(id) });
  const views = (p.views || 0) + (isOwner ? 0 : 1);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/market" style={{ color: C.brand, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>‹ กลับหน้าตลาด</Link>
        <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", marginTop: 12, boxShadow: "0 4px 16px rgba(0,0,0,.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: p.images?.length > 1 ? "2fr 1fr" : "1fr", gap: 4 }}>
            <div style={{ aspectRatio: "1/1", background: "#EDF2F2" }}>
              {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
            </div>
            {p.images?.length > 1 && (
              <div style={{ display: "grid", gap: 4, alignContent: "start" }}>
                {p.images.slice(1, 4).map((u, i) => (
                  <img key={i} src={u} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block", background: "#EDF2F2" }} />
                ))}
              </div>
            )}
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{p.name}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.brand, margin: "6px 0" }}>{baht(p.price)}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
              <span style={{ background: C.brandTint, color: C.brand, fontSize: 11.5, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>{p.cond}</span>
              {p.brand && <span style={{ background: "#F1F3F4", color: C.muted, fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{p.brand}</span>}
              <span style={{ background: "#F1F3F4", color: C.muted, fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>
                {[p.cat_main, p.cat_sub].filter(Boolean).join(" › ")}
              </span>
            </div>
            {(p.issues || []).length > 0 && (
              <div style={{ fontSize: 12.5, color: C.muted }}>ตำหนิ: {p.issues.join(", ")}{p.cond_note ? ` — ${p.cond_note}` : ""}</div>
            )}
            {p.description && <p style={{ fontSize: 13.5, color: C.ink, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{p.description}</p>}
            <div style={{ fontSize: 11.5, color: C.muted, background: C.brandTint, borderRadius: 8, padding: "8px 12px", margin: "10px 0" }}>
              🛡 ทุกออเดอร์ผ่านระบบเงินฝากปลอดภัย — ผู้ขายได้เงินเมื่อคุณยืนยันรับสินค้า
            </div>
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12.5, color: C.muted }}>
                ผู้ขาย: <Link href={`/seller/${p.seller_id}`} style={{ color: C.brand, fontWeight: 800, textDecoration: "none" }}>{seller?.name || "-"} ›</Link>
                {p.location ? ` · ส่งจาก ${p.location}` : ""} · {p.shipping?.label || ""} · เข้าชม {views.toLocaleString()} ครั้ง
              </div>
              {canBuy ? (
                <AddToCartBar product={{ id: p.id, name: p.name, price: p.price, img: p.images?.[0] || null }} />
              ) : (
                <span style={{ height: 44, lineHeight: "44px", padding: "0 26px", borderRadius: 10, background: "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 14 }}>
                  {isOwner ? "สินค้าของคุณ" : "ขายแล้ว"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
