// lib/fees.js — ตรรกะค่าธรรมเนียมยกจาก prototype (feeFor 3 รูปแบบ)
// ⚠️ กติกาเหล็ก: ห้ามคำนวณเงินนอกไฟล์นี้
export function feeFor(price, tiers, side = "buyer") {
  const sorted = [...(tiers || [])].sort((a, b) => a.min - b.min);
  const t = sorted.filter(x => (price || 0) >= Number(x.min)).pop() || sorted[0];
  if (!t) return 0;
  const base = side === "buyer" ? t.buyer_base : t.seller_base;
  if (base != null) {
    const exc = Number(side === "buyer" ? t.buyer_excess_pct : t.seller_excess_pct) || 0;
    return Math.round(Number(base) + Math.max(0, (price || 0) - Number(t.min)) * exc / 100);
  }
  const pct = Number(side === "buyer" ? t.buyer_pct : t.seller_pct);
  if (pct > 0) return Math.round((price || 0) * pct / 100);
  return Number(side === "buyer" ? t.buyer : t.seller) || 0;
}

export function feeTierRange(price, tiers) {
  const sorted = [...(tiers || [])].sort((a, b) => a.min - b.min);
  const idx = sorted.reduce((acc, x, j) => ((price || 0) >= Number(x.min) ? j : acc), 0);
  const t = sorted[idx], n = sorted[idx + 1];
  if (!t) return { t: null, label: "" };
  return { t, label: n ? `${Number(t.min).toLocaleString()} – ${(Number(n.min) - 1).toLocaleString()}` : `${Number(t.min).toLocaleString()} ขึ้นไป` };
}

export const netPayout = (price, tiers) => Math.max(0, (price || 0) - feeFor(price, tiers, "seller"));
