# สเปคระบบ SEO — ClubAngler

เอกสารนี้ใช้สั่งงาน dev หรือ Claude Code ได้โดยตรง แบ่งเป็น 5 ขั้นตอน เรียงตามลำดับที่ควรทำ
แต่ละขั้น deploy แยกกันได้ ไม่ต้องรอทำครบ

สถาปัตยกรรม 2 ชั้น:
- **ชั้น Auto** — หน้าสินค้า generate title/meta เองจากข้อมูลผู้ขาย (มีอยู่แล้ว แค่จูนสูตร)
- **ชั้น Editable** — แอดมินแก้ title/description ของหน้าสำคัญได้จากหลังบ้าน (สร้างใหม่ ขั้นตอน 2-4)

---

## ขั้นตอนที่ 1 — จูน Title หน้าสินค้า (งาน 10 นาที ได้ผลทันที)

**ไฟล์:** `app/product/[id]/page.js`

แก้ฟังก์ชัน `generateMetadata`:

1. เพิ่มฟิลด์ใน select: `brand, location, cond`
2. เปลี่ยนสูตร title จาก

```js
const title = `${p.name} · ฿${Number(p.price || 0).toLocaleString()} — ClubAngler`;
```

เป็น

```js
// มือสอง/ของใหม่ ตามสภาพจริง + จังหวัด = คีย์เวิร์ด long-tail ที่คนค้นจริง
const condWord = p.cond === "ของใหม่" ? "" : "มือสอง";
const parts = [p.name, condWord, p.location].filter(Boolean);
const title = `${parts.join(" ")} | ClubAngler`;
```

หมายเหตุ:
- ถ้าชื่อสินค้ามีแบรนด์อยู่แล้ว (ผู้ขายมักพิมพ์เอง) ไม่ต้องต่อ `p.brand` ซ้ำ — ให้เช็คก่อน: ถ้า `p.brand` และชื่อยังไม่มีคำนั้น (`!p.name.toLowerCase().includes(p.brand.toLowerCase())`) ค่อยแทรกแบรนด์ต่อท้ายชื่อ
- ตัด title ให้ไม่เกิน ~60 ตัวอักษรถ้ายาวเกิน
- เอาราคาออกจาก title (stale ง่าย ไม่ช่วยอันดับ) — ราคายังโชว์ใน rich result ผ่าน Product schema อยู่แล้ว
- description เดิม (slice จาก detail) ใช้ต่อได้ แต่ถ้า detail สั้นกว่า 50 ตัวอักษร ให้ fallback เป็นสูตร: `"ขาย {name} สภาพ{cond_label} จาก{location} ซื้อขายปลอดภัยผ่านระบบพักเงิน escrow ที่ ClubAngler"`

**เพิ่ม `metadataBase`** ใน `app/layout.js` (ทำให้รูป OG เป็น absolute URL เสมอ):

```js
export const metadata = {
  metadataBase: new URL("https://clubangler.com"),
  title: { default: "ClubAngler — ตลาดอุปกรณ์ตกปลา ซื้อขายผ่านระบบเงินฝากปลอดภัย", template: "%s | ClubAngler" },
  description: "ตลาดซื้อขายอุปกรณ์ตกปลา แบบมีคนกลางถือเงิน (escrow)",
};
```

(ถ้าใช้ `template` แล้ว หน้าลูกไม่ต้องต่อ `| ClubAngler` เองอีก — เลือกแนวใดแนวหนึ่งให้สม่ำเสมอทั้งเว็บ)

---

## ขั้นตอนที่ 2 — ตาราง `seo_pages` ใน Supabase

รัน SQL นี้ใน Supabase SQL Editor:

```sql
create table public.seo_pages (
  page_key   text primary key,          -- 'home' | 'market' | 'cat:รอกตกปลา' | 'escrow' ...
  title      text,
  description text,
  intro_html text,                       -- ย่อหน้าแนะนำ โชว์บนหน้าหมวด (ให้ Google มีเนื้อหาอ่าน)
  updated_at timestamptz default now()
);

alter table public.seo_pages enable row level security;

-- ทุกคนอ่านได้ (หน้า public ต้องใช้ render metadata)
create policy "seo_pages_read" on public.seo_pages
  for select using (true);

-- เขียนผ่าน service role (API route ฝั่งแอดมิน) เท่านั้น — ไม่ต้องสร้าง policy insert/update
```

ค่าเริ่มต้น (seed):

```sql
insert into public.seo_pages (page_key, title, description) values
('home',   'ClubAngler — ตลาดอุปกรณ์ตกปลามือสอง ซื้อขายปลอดภัยผ่านระบบพักเงิน', 'ซื้อขายคันเบ็ด รอก เหยื่อปลอม อุปกรณ์ตกปลามือหนึ่ง-มือสอง เงินของคุณถูกพักไว้จนกว่าจะได้รับสินค้า'),
('market', 'ตลาดสินค้า — ซื้อขายอุปกรณ์ตกปลา มือหนึ่ง/มือสอง', 'รวมคันเบ็ด รอก เหยื่อปลอม และอุปกรณ์ตกปลาทุกชนิด ซื้อขายปลอดภัยผ่านระบบเงินฝากคนกลาง (escrow)');
```

---

## ขั้นตอนที่ 3 — API route แอดมินแก้ SEO

**ไฟล์ใหม่:** `app/api/admin/seo-pages/route.js`
ก๊อปโครงจาก `app/api/admin/platform-config/route.js` (requireAdmin + whitelist) แล้วปรับ:

```js
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED = ["title", "description", "intro_html"];
const MAX = { title: 70, description: 170 };   // กันยาวเกินจน Google ตัด

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return p?.is_admin ? { user, admin } : null;
}

// GET: รายการ SEO ทุกหน้า (ให้แท็บแอดมินโหลด)
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });
  const { data } = await ctx.admin.from("seo_pages").select("*").order("page_key");
  return NextResponse.json({ pages: data || [] });
}

// POST: บันทึก { page_key, title, description, intro_html }
export async function POST(req) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });

  const body = await req.json();
  const page_key = String(body.page_key || "").trim();
  if (!page_key) return NextResponse.json({ error: "ไม่ระบุหน้า" }, { status: 400 });

  const patch = { page_key, updated_at: new Date().toISOString() };
  for (const k of ALLOWED) if (k in body) {
    let v = String(body[k] ?? "").trim();
    if (MAX[k] && v.length > MAX[k]) v = v.slice(0, MAX[k]);
    patch[k] = v || null;
  }

  const { error } = await ctx.admin.from("seo_pages").upsert(patch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

**helper อ่านค่า (ใช้ซ้ำทุกหน้า public):** ไฟล์ใหม่ `lib/seo.js`

```js
import { createClient } from "@supabase/supabase-js";

// อ่านอย่างเดียว ใช้ key public — ใช้ได้ทั้งใน generateMetadata และ sitemap
export async function getSeoPage(pageKey) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase.from("seo_pages").select("*").eq("page_key", pageKey).single();
    return data || null;
  } catch { return null; }
}
```

---

## ขั้นตอนที่ 4 — แท็บ "SEO" ในหลังบ้านแอดมิน

**ไฟล์ใหม่:** `app/admin/SeoPanel.js` (ต่อเข้า `AdminClient.js` เป็นแท็บใหม่ ตามแพทเทิร์นแท็บเดิม เช่น BannedWordsPanel)

องค์ประกอบต่อ 1 หน้า (loop จากผล GET + รายการหมวดจาก `CAT_MAINS`):

1. **ช่อง Title** — นับตัวอักษรสด แถบสี: เขียว ≤60 / เหลือง 61-70
2. **ช่อง Description** — เขียว ≤150 / เหลือง 151-170
3. **ช่อง intro_html** — textarea ย่อหน้าแนะนำ (เฉพาะหน้าหมวด)
4. **กล่อง Preview แบบ Google** (แบบเดียวกับ MakeWeb) — แค่ div จัดสไตล์:

```jsx
function SerpPreview({ title, description, url }) {
  return (
    <div style={{ fontFamily: "arial, sans-serif", maxWidth: 600, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
      <div style={{ color: "#202124", fontSize: 12 }}>{url}</div>
      <div style={{ color: "#1a0dab", fontSize: 20, lineHeight: 1.3 }}>
        {title?.length > 60 ? title.slice(0, 60) + "…" : title}
      </div>
      <div style={{ color: "#4d5156", fontSize: 14 }}>
        {description?.length > 155 ? description.slice(0, 155) + "…" : description}
      </div>
    </div>
  );
}
```

5. ปุ่มบันทึก → POST `/api/admin/seo-pages`

รายการหน้าที่โชว์ในแท็บ:
- `home`, `market`
- `cat:{ชื่อหมวด}` ทุกหมวดจาก `CAT_MAINS` (import จาก `lib/catalog.js`)
- (อนาคต) `escrow` หน้าอธิบายระบบพักเงิน

**ต่อเข้าหน้า public:** แก้ `generateMetadata` ให้อ่าน DB ก่อน fallback ค่าเดิม

`app/market/page.js` — เปลี่ยนจาก `export const metadata = {...}` เป็น:

```js
import { getSeoPage } from "@/lib/seo";

export async function generateMetadata() {
  const seo = await getSeoPage("market");
  return {
    title: seo?.title || "ตลาดสินค้า — ClubAngler ซื้อขายอุปกรณ์ตกปลา มือหนึ่ง/มือสอง",
    description: seo?.description || "รวมคันเบ็ด รอก เหยื่อปลอม และอุปกรณ์ตกปลาทุกชนิด ซื้อขายปลอดภัยผ่านระบบเงินฝากคนกลาง (escrow)",
  };
}
```

`app/page.js` (หน้าแรก) — เพิ่ม `generateMetadata` แบบเดียวกัน key `home`

---

## ขั้นตอนที่ 5 — หน้าหมวดหมู่ `/market/[cat]` (ตัวคูณ SEO ทั้งระบบ)

**ไฟล์ใหม่:** `app/market/[cat]/page.js`

```js
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CAT_MAINS } from "@/lib/catalog";
import { getSeoPage } from "@/lib/seo";
import MarketClient from "../MarketClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { cat: raw } = await params;
  const cat = decodeURIComponent(raw);
  if (!CAT_MAINS.includes(cat)) return { title: "ไม่พบหมวดหมู่ — ClubAngler" };

  const seo = await getSeoPage(`cat:${cat}`);
  return {
    title: seo?.title || `${cat}มือสอง ราคาดี ซื้อขายปลอดภัยมีระบบพักเงิน | ClubAngler`,
    description: seo?.description ||
      `รวมประกาศขาย${cat} มือหนึ่งและมือสอง ตรวจสอบได้ทุกชิ้น เงินถูกพักไว้จนกว่าคุณได้รับสินค้า`,
    alternates: { canonical: `/market/${encodeURIComponent(cat)}` },
  };
}

export default async function CategoryPage({ params }) {
  const { cat: raw } = await params;
  const cat = decodeURIComponent(raw);
  if (!CAT_MAINS.includes(cat)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const seo = await getSeoPage(`cat:${cat}`);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, cond, cond_label, brand, location, images, image_ratio, status, cat_main, cat_sub, shipping, views, created_at, seller_id")
    .eq("cat_main", cat)
    .in("status", ["active", "sold"])
    .order("created_at", { ascending: false })
    .limit(60);

  // join ผู้ขาย — ก๊อปแพทเทิร์นจาก app/market/page.js เดิม
  const sellerIds = [...new Set((products || []).map(p => p.seller_id).filter(Boolean))];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, name, is_shop, kyc_status, avatar_path").in("id", sellerIds)
    : { data: [] };
  const sellerMap = Object.fromEntries((sellers || []).map(s => [s.id, s]));
  const rows = (products || []).map(p => ({ ...p, seller: sellerMap[p.seller_id] || null }));

  return (
    <>
      {/* h1 + ย่อหน้าแนะนำ = เนื้อหาที่ทำให้หน้าหมวดติดอันดับ ไม่ใช่การ์ดสินค้าล้วนๆ */}
      <section style={{ padding: "16px 16px 0" }}>
        <h1>{cat}มือสอง และมือหนึ่ง</h1>
        {seo?.intro_html && <div dangerouslySetInnerHTML={{ __html: seo.intro_html }} />}
      </section>
      <MarketClient products={rows} loggedIn={!!user} />
    </>
  );
}
```

หมายเหตุ:
- `MarketClient` อาจต้องรับ prop เพิ่มเพื่อซ่อน/ตั้งค่า filter หมวดเริ่มต้น — ปรับตามจริง
- ทำลิงก์จากหน้า `/market` ไปแต่ละหมวด (แถบหมวดที่มีอยู่แล้วให้เปลี่ยนจาก filter ฝั่ง client เป็นลิงก์จริง `<Link href>` — Google ต้องเห็นลิงก์ถึงจะ crawl เจอ)
- `intro_html` มาจากแอดมินเท่านั้น (ตาราง seo_pages เขียนได้เฉพาะ service role) จึงใช้ dangerouslySetInnerHTML ได้ แต่ถ้าจะเข้มขึ้นให้ sanitize ก่อน render

**อัพเดต `app/sitemap.js`** — เพิ่มหมวดทั้งหมด:

```js
import { CAT_MAINS } from "@/lib/catalog";

// เพิ่มใน array ที่ return:
const categoryPages = CAT_MAINS.map((cat) => ({
  url: `${BASE}/market/${encodeURIComponent(cat)}`,
  changeFrequency: "daily",
  priority: 0.8,
}));

return [...staticPages, ...categoryPages, ...productPages];
```

---

## ลำดับการ deploy + เช็คหลังขึ้น

1. ขั้น 1 (จูน title สินค้า) → deploy ได้เลย
2. ขั้น 2-3 (ตาราง + API) → deploy คู่กัน
3. ขั้น 4 (แท็บแอดมิน) → deploy แล้วลองแก้ title หน้า market ดูว่าเปลี่ยนจริง
4. ขั้น 5 (หน้าหมวด) → deploy แล้วเข้า Google Search Console:
   - Submit sitemap ใหม่ (URL เดิม ระบบจะเห็นหน้าหมวดเพิ่มเอง)
   - ใช้ URL Inspection ตรวจหน้าหมวด 2-3 หน้า กด Request Indexing
5. รอ 1-2 สัปดาห์ ดูรายงาน Performance ว่าหน้าหมวดเริ่มมี impression จากคำว่า "{หมวด}มือสอง" หรือยัง

## สิ่งที่ไม่ต้องทำ

- ช่อง meta keywords แบบ MakeWeb — Google เลิกใช้แล้ว ไม่มีผลต่ออันดับ
- ให้แอดมินแก้ SEO รายสินค้า — ใช้ชั้น Auto พอ ไม่สเกลถ้าทำมือ
